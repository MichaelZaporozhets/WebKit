// Generates the benchmark page: a Magpie-shaped admin screen built from real
// @shopify/polaris class names (served with the real polaris styles.css).
// Deterministic (seeded PRNG) so renders are comparable across engines/runs.

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const ICON = (d) =>
  `<span class="Polaris-Icon"><svg viewBox="0 0 20 20" class="Polaris-Icon__Svg" focusable="false" aria-hidden="true"><path d="${d}"/></svg></span>`;
const ICONS = [
  'M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 3a1 1 0 0 1 1 1v3h3a1 1 0 1 1 0 2h-3v3a1 1 0 1 1-2 0v-3H6a1 1 0 1 1 0-2h3V6a1 1 0 0 1 1-1z',
  'M3 4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4zm2 1v10h10V5H5z',
  'M10 1l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.4 4.8 17.1l1-5.8L1.5 7.2l5.9-.9L10 1z',
  'M4 10a6 6 0 1 1 12 0 6 6 0 0 1-12 0zm6-8a8 8 0 1 0 0 16 8 8 0 0 0 0-16z',
  'M2 5h16v2H2V5zm0 4h16v2H2V9zm0 4h16v2H2v-2z',
];

const PRODUCTS = ['Aurora Lamp', 'Basalt Planter', 'Cedar Shelf', 'Dune Throw', 'Ember Mug', 'Fjord Chair', 'Glacier Vase', 'Harbor Tote', 'Iris Candle', 'Juniper Rug'];
const VENDORS = ['Northwind', 'Fabrikam', 'Contoso', 'Tailspin', 'Adatum'];
const TONES = [['toneSuccess', 'Active'], ['toneAttention', 'Draft'], ['toneCritical', 'Archived'], ['toneInfo', 'Scheduled']];

export function renderPage({ rows = 60, seed = 42 } = {}) {
  const rand = rng(seed);
  const pick = (a) => a[Math.floor(rand() * a.length)];

  const tableRows = Array.from({ length: rows }, (_, i) => {
    const [tone, label] = pick(TONES);
    const qty = Math.floor(rand() * 500);
    const price = (rand() * 400 + 5).toFixed(2);
    return `<tr class="Polaris-IndexTable__TableRow">
      <td class="Polaris-IndexTable__TableCell Polaris-IndexTable__TableCell--first"><span class="Polaris-Checkbox"><input type="checkbox" class="Polaris-Checkbox__Input" aria-label="Select row ${i}"><span class="Polaris-Checkbox__Backdrop"></span></span></td>
      <td class="Polaris-IndexTable__TableCell"><div class="Polaris-InlineStack" style="--pc-inline-stack-gap-xs:var(--p-space-300);--pc-inline-stack-align-items:center;--pc-inline-stack-wrap:nowrap"><span class="Polaris-Thumbnail Polaris-Thumbnail--sizeSmall"><span style="display:block;width:40px;height:40px;border-radius:var(--p-border-radius-200);background:hsl(${Math.floor(rand() * 360)} 60% 85%)"></span></span><div class="Polaris-BlockStack" style="--pc-block-stack-gap-xs:var(--p-space-050)"><span class="Polaris-Text--root Polaris-Text--bodyMd Polaris-Text--semibold">${pick(PRODUCTS)} #${1000 + i}</span><span class="Polaris-Text--root Polaris-Text--bodySm Polaris-Text--subdued">${pick(VENDORS)} · SKU-${Math.floor(rand() * 90000 + 10000)}</span></div></div></td>
      <td class="Polaris-IndexTable__TableCell"><span class="Polaris-Badge Polaris-Badge--${tone}"><span class="Polaris-Text--root Polaris-Text--bodySm">${label}</span></span></td>
      <td class="Polaris-IndexTable__TableCell Polaris-IndexTable__TableCell--numeric"><span class="Polaris-Text--root Polaris-Text--bodyMd Polaris-Text--numeric">${qty} in stock</span></td>
      <td class="Polaris-IndexTable__TableCell Polaris-IndexTable__TableCell--numeric"><span class="Polaris-Text--root Polaris-Text--bodyMd Polaris-Text--numeric">$${price}</span></td>
      <td class="Polaris-IndexTable__TableCell"><div class="Polaris-InlineStack" style="--pc-inline-stack-gap-xs:var(--p-space-100)">${Array.from({ length: 1 + Math.floor(rand() * 3) }, (_, t) => `<span class="Polaris-Tag"><span class="Polaris-Tag__Text">tag-${t}</span></span>`).join('')}</div></td>
      <td class="Polaris-IndexTable__TableCell"><button class="Polaris-Button Polaris-Button--pressable Polaris-Button--variantTertiary Polaris-Button--sizeMedium Polaris-Button--iconOnly" type="button" aria-label="Actions">${ICON(ICONS[4])}</button></td>
    </tr>`;
  }).join('\n');

  const formFields = ['Title', 'Handle', 'Vendor', 'Product type', 'Barcode', 'Weight'].map((label, i) => `
    <div class="Polaris-Labelled__LabelWrapper"><div class="Polaris-Label"><label class="Polaris-Label__Text" for="f${i}"><span class="Polaris-Text--root Polaris-Text--bodyMd">${label}</span></label></div></div>
    <div class="Polaris-Connected"><div class="Polaris-Connected__Item Polaris-Connected__Item--primary"><div class="Polaris-TextField"><input id="f${i}" class="Polaris-TextField__Input" type="text" value="${label} value ${i}" autocomplete="off"><div class="Polaris-TextField__Backdrop"></div></div></div></div>`).join('\n');

  return `<!doctype html>
<html lang="en" class="p-theme-light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Magpie bench fixture</title>
<link rel="stylesheet" href="/polaris.css">
<style>
  body { margin: 0; background: var(--p-color-bg); color: var(--p-color-text); font-family: var(--p-font-family-sans); }
  .bench-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--p-space-400); }
  @media (max-width: 767px) { .bench-grid { grid-template-columns: 1fr 1fr; } }
</style>
</head>
<body>
<div class="Polaris-Page Polaris-Page--fullWidth">
  <div class="Polaris-Page-Header Polaris-Page-Header--isSingleRow Polaris-Page-Header--noBreadcrumbs">
    <div class="Polaris-Page-Header__Row">
      <div class="Polaris-Page-Header__TitleWrapper"><h1 class="Polaris-Header-Title"><span class="Polaris-Text--root Polaris-Text--headingLg">Products</span></h1><span class="Polaris-Badge Polaris-Badge--toneInfo"><span class="Polaris-Text--root Polaris-Text--bodySm">${rows} items</span></span></div>
      <div class="Polaris-Page-Header__RightAlign"><div class="Polaris-ActionMenu"><div class="Polaris-InlineStack" style="--pc-inline-stack-gap-xs:var(--p-space-200)">
        <button class="Polaris-Button Polaris-Button--pressable Polaris-Button--variantSecondary Polaris-Button--sizeMedium Polaris-Button--textAlignCenter" type="button"><span class="Polaris-Text--root Polaris-Text--bodySm Polaris-Text--medium">Export</span></button>
        <button class="Polaris-Button Polaris-Button--pressable Polaris-Button--variantSecondary Polaris-Button--sizeMedium Polaris-Button--textAlignCenter" type="button"><span class="Polaris-Text--root Polaris-Text--bodySm Polaris-Text--medium">Import</span></button>
        <button class="Polaris-Button Polaris-Button--pressable Polaris-Button--variantPrimary Polaris-Button--sizeMedium Polaris-Button--textAlignCenter" type="button">${ICON(ICONS[0])}<span class="Polaris-Text--root Polaris-Text--bodySm Polaris-Text--medium">Add product</span></button>
      </div></div></div>
    </div>
  </div>

  <div class="Polaris-Layout">
    <div class="Polaris-Layout__Section">
      <div class="Polaris-BlockStack" style="--pc-block-stack-gap-xs:var(--p-space-400)">
        <div class="Polaris-Banner Polaris-Banner--withinPage" role="status"><div class="Polaris-Box" style="--pc-box-padding-block-start-xs:var(--p-space-300);--pc-box-padding-block-end-xs:var(--p-space-300);--pc-box-padding-inline-start-xs:var(--p-space-300);--pc-box-padding-inline-end-xs:var(--p-space-300);--pc-box-background:var(--p-color-bg-surface-info);--pc-box-border-radius:var(--p-border-radius-300)"><div class="Polaris-InlineStack" style="--pc-inline-stack-gap-xs:var(--p-space-200);--pc-inline-stack-wrap:nowrap">${ICON(ICONS[3])}<span class="Polaris-Text--root Polaris-Text--bodyMd">Inventory sync finished 4 minutes ago. 3 products need attention.</span></div></div></div>

        <div class="bench-grid">
          ${['Total sales', 'Orders', 'Conversion', 'Returning customers'].map((t, i) => `<div class="Polaris-ShadowBevel" style="--pc-shadow-bevel-z-index:32;--pc-shadow-bevel-content-xs:'';--pc-shadow-bevel-box-shadow-xs:var(--p-shadow-100);--pc-shadow-bevel-border-radius-xs:var(--p-border-radius-300)"><div class="Polaris-Box" style="--pc-box-background:var(--p-color-bg-surface);--pc-box-padding-block-start-xs:var(--p-space-400);--pc-box-padding-block-end-xs:var(--p-space-400);--pc-box-padding-inline-start-xs:var(--p-space-400);--pc-box-padding-inline-end-xs:var(--p-space-400);--pc-box-min-height:100%;--pc-box-overflow-x:clip;--pc-box-overflow-y:clip"><div class="Polaris-BlockStack" style="--pc-block-stack-gap-xs:var(--p-space-200)"><span class="Polaris-Text--root Polaris-Text--headingSm">${t}</span><span class="Polaris-Text--root Polaris-Text--headingXl">${['$12,480.20', '1,284', '3.8%', '42%'][i]}</span><div class="Polaris-ProgressBar Polaris-ProgressBar--sizeSmall Polaris-ProgressBar--toneHighlight"><progress class="Polaris-ProgressBar__Progress" value="${30 + i * 15}" max="100"></progress><div class="Polaris-ProgressBar__Indicator Polaris-ProgressBar__IndicatorAppearActive" style="--pc-progress-bar-duration:500ms;--pc-progress-bar-percent:${(30 + i * 15) / 100}"><span class="Polaris-ProgressBar__Label">${30 + i * 15}%</span></div></div></div></div></div>`).join('\n')}
        </div>

        <div class="Polaris-ShadowBevel" style="--pc-shadow-bevel-z-index:32;--pc-shadow-bevel-content-xs:'';--pc-shadow-bevel-box-shadow-xs:var(--p-shadow-100);--pc-shadow-bevel-border-radius-xs:var(--p-border-radius-300)"><div class="Polaris-Box" style="--pc-box-background:var(--p-color-bg-surface);--pc-box-overflow-x:clip;--pc-box-overflow-y:clip;--pc-box-border-radius:var(--p-border-radius-300)">
          <div class="Polaris-Tabs__Outer"><div class="Polaris-Tabs__Wrapper"><ul class="Polaris-Tabs" role="tablist">${['All', 'Active', 'Draft', 'Archived'].map((t, i) => `<li class="Polaris-Tabs__TabContainer" role="presentation"><button class="Polaris-Tabs__Tab${i === 0 ? ' Polaris-Tabs__Tab--active' : ''}" role="tab" type="button" aria-selected="${i === 0}"><span class="Polaris-Text--root Polaris-Text--bodySm Polaris-Text--medium">${t}</span></button></li>`).join('')}</ul></div></div>
          <div class="Polaris-IndexTable"><div class="Polaris-IndexTable__ScrollContainer"><table class="Polaris-IndexTable__Table Polaris-IndexTable__Table--sticky">
            <thead><tr>
              <th class="Polaris-IndexTable__TableHeading Polaris-IndexTable__TableHeading--first"><span class="Polaris-Checkbox"><input type="checkbox" class="Polaris-Checkbox__Input" aria-label="Select all"><span class="Polaris-Checkbox__Backdrop"></span></span></th>
              ${['Product', 'Status', 'Inventory', 'Price', 'Tags', ''].map((h) => `<th class="Polaris-IndexTable__TableHeading"><span class="Polaris-Text--root Polaris-Text--bodySm Polaris-Text--medium">${h}</span></th>`).join('')}
            </tr></thead>
            <tbody>${tableRows}</tbody>
          </table></div></div>
        </div></div>
      </div>
    </div>

    <div class="Polaris-Layout__Section Polaris-Layout__Section--oneThird">
      <div class="Polaris-ShadowBevel" style="--pc-shadow-bevel-z-index:32;--pc-shadow-bevel-content-xs:'';--pc-shadow-bevel-box-shadow-xs:var(--p-shadow-100);--pc-shadow-bevel-border-radius-xs:var(--p-border-radius-300)"><div class="Polaris-Box" style="--pc-box-background:var(--p-color-bg-surface);--pc-box-padding-block-start-xs:var(--p-space-400);--pc-box-padding-block-end-xs:var(--p-space-400);--pc-box-padding-inline-start-xs:var(--p-space-400);--pc-box-padding-inline-end-xs:var(--p-space-400);--pc-box-border-radius:var(--p-border-radius-300)">
        <div class="Polaris-BlockStack" style="--pc-block-stack-gap-xs:var(--p-space-300)">
          <span class="Polaris-Text--root Polaris-Text--headingMd">Product details</span>
          ${formFields}
          <div class="Polaris-Select"><select class="Polaris-Select__Input" aria-label="Status"><option>Active</option><option>Draft</option></select><div class="Polaris-Select__Content" aria-hidden="true"><span class="Polaris-Select__SelectedOption">Active</span><span class="Polaris-Select__Icon">${ICON(ICONS[4])}</span></div><div class="Polaris-Select__Backdrop"></div></div>
          <hr class="Polaris-Divider" style="border-block-start:var(--p-border-width-025) solid var(--p-color-border-secondary)">
          <div class="Polaris-InlineStack" style="--pc-inline-stack-gap-xs:var(--p-space-200);--pc-inline-stack-align:end">
            <button class="Polaris-Button Polaris-Button--pressable Polaris-Button--variantSecondary Polaris-Button--toneCritical Polaris-Button--sizeMedium" type="button"><span class="Polaris-Text--root Polaris-Text--bodySm Polaris-Text--medium">Delete</span></button>
            <button class="Polaris-Button Polaris-Button--pressable Polaris-Button--variantPrimary Polaris-Button--sizeMedium" type="button"><span class="Polaris-Text--root Polaris-Text--bodySm Polaris-Text--medium">Save</span></button>
          </div>
        </div>
      </div></div>
    </div>
  </div>
</div>
</body>
</html>`;
}
