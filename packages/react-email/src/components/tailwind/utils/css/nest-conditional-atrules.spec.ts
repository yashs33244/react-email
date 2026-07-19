import { generate, parse, type StyleSheet } from 'css-tree';
import { extractRulesPerClass } from './extract-rules-per-class.js';
import { nestConditionalAtrules } from './nest-conditional-atrules.js';

const run = (css: string) => {
  const styleSheet = parse(css) as StyleSheet;
  nestConditionalAtrules(styleSheet);
  return generate(styleSheet);
};

describe('nestConditionalAtrules()', () => {
  it('nests a media-wrapped rule inside the rule (tailwindcss 4.3.3 shape)', () => {
    expect(
      run(
        '@media (prefers-color-scheme: dark){.dark\\:bg-black{background-color:#000}}',
      ),
    ).toBe(
      '.dark\\:bg-black{@media (prefers-color-scheme:dark){background-color:#000}}',
    );
  });

  it('nests every rule of a shared media block separately', () => {
    expect(
      run(
        '@media (width>=40rem){.sm\\:text-lg{font-size:1.125rem}.sm\\:p-4{padding:1rem}}',
      ),
    ).toBe(
      '.sm\\:text-lg{@media (width>=40rem){font-size:1.125rem}}.sm\\:p-4{@media (width>=40rem){padding:1rem}}',
    );
  });

  it('preserves pseudo selectors on the nested rule', () => {
    expect(
      run(
        '@media (hover: hover){.hover\\:underline:hover{text-decoration-line:underline}}',
      ),
    ).toBe(
      '.hover\\:underline:hover{@media (hover:hover){text-decoration-line:underline}}',
    );
  });

  it('nests stacked media queries innermost-first', () => {
    expect(
      run(
        '@media (width>=40rem){@media (prefers-color-scheme: dark){.sm\\:dark\\:bg-black{background-color:#000}}}',
      ),
    ).toBe(
      '.sm\\:dark\\:bg-black{@media (width>=40rem){@media (prefers-color-scheme:dark){background-color:#000}}}',
    );
  });

  it('nests @supports the same way', () => {
    expect(
      run('@supports (display: grid){.supports-grid\\:grid{display:grid}}'),
    ).toBe('.supports-grid\\:grid{@supports (display:grid){display:grid}}');
  });

  it('reaches media queries inside @layer without touching the layer itself', () => {
    expect(
      run(
        '@layer utilities{@media (prefers-color-scheme: dark){.dark\\:bg-black{background-color:#000}}}',
      ),
    ).toBe(
      '@layer utilities{.dark\\:bg-black{@media (prefers-color-scheme:dark){background-color:#000}}}',
    );
  });

  it('leaves already-nested rules untouched (tailwindcss <= 4.3.2 shape)', () => {
    const nested =
      '.dark\\:bg-black{@media (prefers-color-scheme:dark){background-color:#000}}';
    expect(run(nested)).toBe(nested);
  });

  it('keeps variant declarations out of the inlinable set', () => {
    const styleSheet = parse(
      '@media (prefers-color-scheme: dark){.dark\\:bg-black{background-color:#000}}',
    ) as StyleSheet;
    nestConditionalAtrules(styleSheet);
    const { inlinable, nonInlinable } = extractRulesPerClass(styleSheet, [
      'dark:bg-black',
    ]);
    expect(inlinable.has('dark:bg-black')).toBe(false);
    expect(nonInlinable.has('dark:bg-black')).toBe(true);
  });
});
