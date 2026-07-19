import {
  type Atrule,
  type CssNode,
  clone,
  List,
  type ListItem,
  type Rule,
  type StyleSheet,
  walk,
} from 'css-tree';

/**
 * Re-nests rules found inside conditional at-rules so variants always reach
 * the inlining pipeline in the nested form it was built around:
 *
 * Before: `@media (prefers-color-scheme: dark) { .dark_bg-black { background-color: #000 } }`
 * After:  `.dark_bg-black { @media (prefers-color-scheme: dark) { background-color: #000 } }`
 *
 * tailwindcss up to 4.3.2 emitted variants nested inside the utility's rule;
 * 4.3.3 flattened them to `@media { rule }`. In that shape the inner rule has
 * no at-rule inside it, so extractRulesPerClass() treated it as inlinable —
 * `dark:`/`sm:` declarations leaked into the base inline styles and the
 * <style> block came out empty. downlevelForEmailClients() flattens the
 * nesting back at the end of the pipeline.
 *
 * Mutates the stylesheet in place.
 */
export function nestConditionalAtrules(styleSheet: StyleSheet): void {
  const transforms: Array<{
    atrule: Atrule;
    block: NonNullable<Atrule['block']>;
    item: ListItem<CssNode>;
    list: List<CssNode>;
  }> = [];

  walk(styleSheet, {
    visit: 'Atrule',
    leave(atrule, item, list) {
      if (atrule.name !== 'media' && atrule.name !== 'supports') return;
      if (!atrule.block || !item) return;
      // An at-rule inside a rule (`.cls { @media {...} }`) is already the
      // nested form; only flattened `@media { .cls {...} }` needs re-nesting.
      if (this.rule) return;
      transforms.push({ atrule, block: atrule.block, item, list });
    },
  });

  // Leave order is innermost-first, so by the time an outer at-rule is
  // applied its block already holds the re-nested rules of any inner one.
  for (const { atrule, block, item, list } of transforms) {
    const rules: Rule[] = [];
    let onlyRules = true;
    block.children.forEach((child) => {
      if (child.type === 'Rule') {
        rules.push(child);
      } else {
        onlyRules = false;
      }
    });
    // Anything but plain rules (e.g. bare declarations of an already-nested
    // at-rule) is left untouched.
    if (!onlyRules || rules.length === 0) continue;

    const wrapped = rules.map(
      (rule): Rule => ({
        type: 'Rule',
        prelude: rule.prelude,
        block: {
          type: 'Block',
          children: new List<CssNode>().fromArray([
            {
              type: 'Atrule',
              name: atrule.name,
              prelude: atrule.prelude
                ? (clone(atrule.prelude) as Atrule['prelude'])
                : null,
              block: rule.block,
            },
          ]),
        },
      }),
    );

    list.replace(item, new List<CssNode>().fromArray(wrapped));
  }
}
