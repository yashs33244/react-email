---
"react-email": patch
---

Keep `dark:`/`sm:` media-query variants in the `<style>` block with tailwindcss 4.3.3, which flattened its emitted CSS so variant rules leaked into inline styles.
