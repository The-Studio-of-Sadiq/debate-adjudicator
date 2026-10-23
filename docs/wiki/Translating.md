# Translating the app

Every word in the app comes from a dictionary file, so adding a language
needs no programming. English is the reference; a translation can be partial,
and anything not yet translated shows in English.

## Start a new language

You need [Node.js](https://nodejs.org/) and a copy of the
[source code](https://github.com/The-Studio-of-Sadiq/debate-adjudicator).
From the project folder, run:

```bash
npm install
npm run i18n:new -- bn "বাংলা" "Bangla"
```

The three values are the language code, the language's name in itself (shown
in the app's language picker) and its English name. Use a
[BCP 47 code](https://en.wikipedia.org/wiki/IETF_language_tag): a two- or
three-letter code like `bn`, `es` or `fil`, plus a region or script when it
matters, like `pt-BR` or `zh-Hant`.

This creates `apps/app/src/i18n/bn.ts`, a copy of the English dictionary,
and adds the language to the picker.

## Translate

Open the new file and replace each English text with your translation:

```ts
home: {
  newRound: 'নতুন রাউন্ড',
  startRound: 'রাউন্ড শুরু করুন',
```

- **Keep the keys** (the part before the colon) exactly as they are.
- **Keep placeholders** like `{{time}}`, `{{seat}}` or `{{count}}`. You can
  move them within the sentence: `'{{time}} বাকি'`.
- **Plurals:** keys ending in `_one` and `_other` are picked by the number.
  Languages with more plural forms can add `_zero`, `_two`, `_few` or `_many`;
  see the [CLDR plural rules](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html).
- **Skip anything** by deleting its line; it will show in English.
- Debate terms (POI, BP, Prime Minister…) can stay in English if that's what
  debaters in your language use.

## Check your work

```bash
npm run check:i18n
```

It reports how much is translated, and stops on mistakes such as a mistyped
key or a placeholder English doesn't have:

```
Languages:
  bn: 120/297 strings translated (40%)
```

To see it in the app, run it (`npm run web` in a browser, or `npm run desktop`
on Windows) and choose your language under **Home → Language**.

## Send it in

Open a pull request with your file (see
[CONTRIBUTING](https://github.com/The-Studio-of-Sadiq/debate-adjudicator/blob/main/CONTRIBUTING.md)).
Partial translations are welcome. Not comfortable with Git? Open a
[translation issue](https://github.com/The-Studio-of-Sadiq/debate-adjudicator/issues/new?template=translation.yml)
and we'll help.
