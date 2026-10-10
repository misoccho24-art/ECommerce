// Catalog + imagery. Photos are free-licensed Unsplash images served from their CDN at the exact
// size each slot needs (see img() in app.js). Swap the ids for your own product shots any time.
window.CATALOG = (() => {
  const cats = {
    lifestyle: { name: "Lifestyle" },
    running: { name: "Running" },
    canvas: { name: "Canvas" },
    leather: { name: "Leather" },
  };
  // [name, category, price, was, rating, reviews, unsplash id, colorway, blurb, tag]
  const P = [
    ["Ivory Court Low", "lifestyle", 120, null, 4.8, 412, "1622760807800-66cf1466fc08", "Ivory / Bone", "A clean court silhouette in tumbled leather with a cushioned cupsole that softens with every wear.", "New"],
    ["Sandstone Chukka", "leather", 165, null, 4.9, 208, "1517389274750-a758d503b69e", "Sand Suede", "Water-resistant suede chukka on a natural crepe sole. Dresses up, dresses down.", "New"],
    ["Clay Court Retro", "lifestyle", 110, 138, 4.6, 356, "1697086317645-11bd9e74e2cf", "Chalk / Clay", "Seventies tennis lines, modern foam. Brown suede overlays on a chalk-white base.", null],
    ["Ink Skate Low", "canvas", 85, null, 4.7, 690, "1641997465126-c73cc4070337", "Ink / White", "Double-stitched canvas, vulcanised sole and a padded collar built for the board and the block.", "Bestseller"],
    ["Ember Runner", "running", 135, null, 4.5, 241, "1699092372473-a829f4421580", "Ash / Ember", "Responsive midsole with a rocker toe for smooth miles. Breathable engineered mesh upper.", "New"],
    ["Fog Knit Trainer", "running", 125, null, 4.6, 318, "1680254418556-3980c19d4304", "Fog Grey", "A sock-like knit upper that moves with your foot, on a lightweight everyday trainer sole.", null],
    ["Mocha Tab Low", "lifestyle", 140, null, 4.8, 167, "1603808033192-082d6919d3e1", "White / Mocha", "Full-grain leather with mocha suede tabs and a waxed cotton lace. Made to age well.", "New"],
    ["Crimson Air Trainer", "running", 150, 179, 4.7, 523, "1600185365483-26d7a4cc7519", "White / Crimson", "Visible cushioning and a sculpted heel counter. All-day comfort with a loud colourway.", null],
    ["Sunset Racer", "running", 145, null, 4.6, 284, "1560769629-975ec94e6a86", "White / Sunset", "Low-profile racer with a grippy rubber outsole and a heel tab you can actually use.", "Bestseller"],
    ["Harbor Court", "lifestyle", 115, null, 4.5, 199, "1698108223703-0af88bee1104", "White / Harbor", "Crisp white leather with tangerine and harbor-blue hits. A summer pair that lasts all year.", null],
    ["Mirror Low", "lifestyle", 130, null, 4.7, 146, "1758702701300-372126112cb4", "Sand / Stone", "Tonal sand suede and nubuck panels on a gum-tinted sole. Quiet, but never boring.", "New"],
    ["Rust Speckle Runner", "running", 128, null, 4.6, 233, "1790516100821-b9ff7180d712", "Rust / Speckle", "A speckled foam midsole and rust-red mesh. Light enough for tempo days.", null],
    ["Daily White", "lifestyle", 95, null, 4.8, 1104, "1571276786523-aefba4a6eb25", "Triple White", "The pair you reach for every morning. Soft leather, cushioned insole, zero fuss.", "Bestseller"],
    ["Asphalt Tempo", "running", 138, 160, 4.5, 177, "1595341888016-a392ef81b7de", "Chalk / Teal", "Built for city pavements: dense rubber outsole, springy foam, reflective heel.", null],
    ["Cloud High", "leather", 155, null, 4.7, 289, "1512374382149-233c42b6a83b", "Cloud White", "A padded high-top in buttery leather with a perforated toe box for airflow.", null],
    ["Canvas Hi Classic", "canvas", 75, null, 4.8, 1532, "1562105962-2fbaaf107fe3", "Black / Cream", "The original high-top. Heavy canvas, rubber toe cap and a sole that grips.", "Bestseller"],
    ["Denim Canvas Low", "canvas", 70, 88, 4.4, 402, "1700673698394-270378d1a70d", "Washed Denim", "Washed denim-blue canvas on a cream sole. Gets better with every scuff.", null],
  ];
  const products = P.map(([name, cat, price, was, rating, reviews, img, color, desc, tag], i) => ({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    name, cat, price, was, rating, reviews, img, color, desc, tag, idx: i,
  }));
  const byId = Object.fromEntries(products.map(p => [p.id, p]));

  const media = {
    hero: "1606964212916-4d23bf4044cb",
    street: "1662320775051-bdabb2d22857",
    canvas: "1700673698394-270378d1a70d",
    leather: "1657034321685-1fba1b2751f3",
    story: "1662320774871-c442b34ce698",
  };
  return { cats, products, byId, media };
})();
