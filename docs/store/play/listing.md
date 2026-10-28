# Google Play store listing

Text and graphics for the default (English) store listing. Graphics are
generated: `npm run brand` makes the icon and feature graphic, and
`npm run store:screenshots` frames the captures in `captures/` as phone
screenshots.

| Field | File / text |
|---|---|
| App icon (512×512) | [`icon-512.png`](icon-512.png) |
| Feature graphic (1024×500) | [`feature-graphic.png`](feature-graphic.png) |
| Phone screenshots (1080×1920, upload in order) | [`phone/`](phone/) |

## Translations

The listing in the app's other 16 languages is in [`listing/`](listing/), one
file per language. They use the app's own terms for each language (see
`apps/app/src/i18n/`), and they are AI-drafted and await native review, like
the app's translations. In Play Console, add each under **Store presence →
Store listings → Manage translations** with this language:

| File | Play Console language | File | Play Console language |
|---|---|---|---|
| [`ar.md`](listing/ar.md) | Arabic – ar | [`ja.md`](listing/ja.md) | Japanese – ja-JP |
| [`bn.md`](listing/bn.md) | Bangla – bn-BD | [`ko.md`](listing/ko.md) | Korean – ko-KR |
| [`de.md`](listing/de.md) | German – de-DE | [`ms.md`](listing/ms.md) | Malay – ms-MY |
| [`es.md`](listing/es.md) | Spanish (Latin America) – es-419 | [`pt.md`](listing/pt.md) | Portuguese (Brazil) – pt-BR |
| [`fr.md`](listing/fr.md) | French – fr-FR | [`ru.md`](listing/ru.md) | Russian – ru-RU |
| [`hi.md`](listing/hi.md) | Hindi – hi-IN | [`tr.md`](listing/tr.md) | Turkish – tr-TR |
| [`id.md`](listing/id.md) | Indonesian – id | [`ur.md`](listing/ur.md) | Urdu – ur |
| [`vi.md`](listing/vi.md) | Vietnamese – vi | [`zh.md`](listing/zh.md) | Chinese (Simplified) – zh-CN |

Play shows the English graphics (with their English captions) for every
language unless localized ones are uploaded.

## App name (18/30)

```
Debate Adjudicator
```

## Short description (75/80)

```
Debate timer, bells, POIs and ballots for BP, UADC and WSDC. Works offline.
```

## Full description

```
Debate Adjudicator runs a debate round from the chair's phone. The timer, bells and points of information reach every phone in the room over local Wi-Fi, with no accounts and no internet needed.

Built for British Parliamentary, UADC (Asian Parliamentary, 7-7-7-4 and 5-5-5-3) and World Schools (WSDC), plus 45 more formats including Australs, Canadian, American Parliamentary and school and league formats. Every speech time, bell and POI window can be edited.

TIMEKEEPING
• A clear speech clock with phases: protected time, POIs open, wrap up, grace and overtime
• Scheduled and manual bells that ring on every device at the same moment
• Searchable format picker and editable bell plans

ONE ROOM, EVERY PHONE
• Debaters, timekeepers and wing adjudicators join by scanning a QR code or typing a short code
• Works over the venue's Wi-Fi or a phone hotspot
• The chair approves each device and assigns roles and seats

POINTS OF INFORMATION AND ORDER
• Debaters raise a POI, Point of Order or Point of Personal Privilege from their own phone
• The speaker accepts or declines POIs; the chair rules on the rest
• The clock pauses while a point is heard

RECORDING AND TRANSCRIPTS
• Record each speech on the chair's phone
• Transcribe offline on the device, or with a cloud service using your own API key (ElevenLabs, OpenAI or Groq)
• English, and Bangla through the cloud. Tap a transcript line to hear it.

ADJUDICATION
• Timestamped flow notes for every speech
• Ballots for every format; team ranks or the winner follow from speaker scores
• Export a printable PDF report of the round

PRIVATE BY DESIGN
Notes, ballots, recordings and transcripts stay on the chair's device. There are no accounts, ads or tracking.

17 LANGUAGES
English, Bangla, Spanish, French, Portuguese, German, Russian, Turkish, Hindi, Chinese (Simplified), Japanese, Korean, Indonesian, Malay, Vietnamese, Arabic and Urdu, with a right-to-left layout for Arabic and Urdu.

Light and dark themes. Free and open source under the MIT License.
```
