# AGENTS.md — Price Update System

## Project identity

This repository is the independent web application for collecting, standardizing, reviewing, and publishing steel-product prices.

The application is independent from the Content System. Do not mix their repositories, databases, environment variables, migrations, or deployment targets.

## Product source of truth

- The product catalog is stored at `data/products/catalog.xlsx`.
- A CSV export may also exist at `data/products/catalog.csv`.
- Products and brands must come from the approved catalog / Website source.
- Do not create new products or brands automatically from scraped text.
- The shared product identity is `product_code`.
- Never publish a price by guessing a product from its name alone.

## Initial pilot

Start with the rebar category only. Build the first vertical slice before expanding to the other six groups:

1. Product and brand catalog
2. Source definition
3. Raw data intake
4. Extraction
5. Product matching
6. Human review
7. Final daily price
8. Controlled Website API publication

Automatic publication must remain disabled during the first pilot unless explicitly enabled by an authorized user.

## Price rules

- Factory price and warehouse price are separate price types.
- Preserve the original raw source item before processing.
- Preserve source URL, message link, file, received time, and parser version.
- A suspicious price cannot be published without human approval.
- Missing daily price is `null` / absent data, never zero.
- Product identity and price observations are separate entities.
- All important changes require an audit record.

## Data sources

Supported source types include public competitor websites, Telegram channels accessible to the organization account, Excel, CSV, PDF, images, and manual text entry.

Use a separate connector for each source structure. Do not bypass authentication, CAPTCHA, paywalls, private areas, or technical access controls. Store the raw input and process only public or authorized data.

## AI usage

Use the OpenAI API as the primary extraction and interpretation service. Keep model selection configurable through environment variables or application settings.

Use AI for:

- price-message classification;
- extraction from text, images, and documents;
- normalization of Persian/English numbers and units;
- suggesting product and brand matches;
- explaining suspicious-price reasons.

Use deterministic code for:

- arithmetic and percentage calculations;
- product-code validation;
- unit conversion rules;
- duplicate detection;
- publication permissions;
- idempotency and audit logging.

AI output must be schema-validated and must not directly publish to the Website.

## UI direction

The UI should be minimal, modern, calm, and highly readable, inspired by Apple product interfaces without copying them.

- generous whitespace;
- restrained glass surfaces;
- subtle blur and soft shadows;
- matte, readable data tables;
- dark steel-blue accent color;
- rounded cards with moderate radius;
- short, subtle transitions;
- no dense dashboard or excessive decoration;
- clear status text in addition to status colors;
- responsive desktop and tablet layout.

Recommended Persian font: `Vazirmatn`.

Recommended visual tokens:

- background `#F5F5F7`
- surface `rgba(255,255,255,0.72)`
- primary `#1D3557`
- text `#1D1D1F`
- muted `#6E6E73`
- success `#16803C`
- warning `#A66A00`
- danger `#C62828`
- border `rgba(0,0,0,0.08)`

## UI structure

The category page contains:

- date selector and previous/next date controls;
- `All brands` tab and one tab per available brand;
- price table: size/product name, factory price, final source, warehouse price, final source, details;
- details modal showing all collected observations and the selected target price;
- historical bar chart with connected points;
- missing days represented as gaps, not zero values;
- image export using the active date, brand, and filters.

## Project structure

```text
price-update-system/
├── apps/
│   ├── web/
│   ├── api/
│   └── worker/
├── data/
│   ├── products/
│   │   ├── catalog.xlsx
│   │   └── catalog.csv
│   ├── brands/
│   ├── samples/
│   └── sources/
├── docs/
├── database/
│   ├── migrations/
│   └── seed/
├── packages/
│   ├── schemas/
│   ├── product-matching/
│   └── shared/
├── .env.example
├── README.md
└── AGENTS.md
```

## Implementation rules

- Use TypeScript with strict typing.
- Keep API, worker, and UI responsibilities separate.
- Use a relational database for products, sources, observations, approvals, and publications.
- Store files in object storage, not in database rows.
- Use queues for OCR, scraping, extraction, and publication.
- Keep secrets in environment variables or a secret manager.
- Do not commit API keys, Telegram sessions, passwords, or production credentials.
- Add tests for product-code matching, unit conversion, duplicate detection, missing days, suspicious prices, and publication idempotency.
- Prefer small vertical slices over broad unfinished modules.

## First development instruction

Before implementing collectors or AI integrations, inspect `data/products/catalog.xlsx`, report its sheets, columns, row counts, duplicate product codes, missing product codes, and brand/category distribution. Do not modify the catalog automatically. Produce a review report in `docs/catalog-review.md` and wait for confirmation before seeding the database.
