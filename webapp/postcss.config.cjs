// Mantine: postcss-preset-mantine даёт light-dark(), rem() и миксины (@mixin hover, smaller-than…),
// postcss-simple-vars — переменные брейкпоинтов для @media в CSS-модулях (значения = дефолты Mantine).
module.exports = {
  plugins: {
    "postcss-preset-mantine": {},
    "postcss-simple-vars": {
      variables: {
        "mantine-breakpoint-xs": "36em",
        "mantine-breakpoint-sm": "48em",
        "mantine-breakpoint-md": "62em",
        "mantine-breakpoint-lg": "75em",
        "mantine-breakpoint-xl": "88em",
      },
    },
  },
};
