import { ScrollViewStyleReset } from 'expo-router/html';

const APP_NAME    = 'Dominos Bet';
const DESCRIPTION = 'Jogue dominó online com apostas de moedas, desafie amigos em salas privadas e suba no ranking. O dominó online mais divertido do Brasil.';
const SITE_URL    = 'https://dominos-bet-sooty.vercel.app';
const OG_IMAGE    = `${SITE_URL}/og-image.png`;

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />

        {/* Primary */}
        <title>{APP_NAME}</title>
        <meta name="description"       content={DESCRIPTION} />
        <meta name="keywords"          content="dominó online, jogo de dominó, dominó aposta, dominó moedas, domino bet, jogo de domino online, domino multiplayer" />
        <meta name="author"            content="Dominos Bet" />
        <meta name="robots"            content="index, follow" />
        <meta name="theme-color"       content="#131313" />
        <link rel="canonical"          href={SITE_URL} />

        {/* Open Graph */}
        <meta property="og:type"        content="website" />
        <meta property="og:url"         content={SITE_URL} />
        <meta property="og:title"       content={APP_NAME} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:image"       content={OG_IMAGE} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:locale"      content="pt_BR" />
        <meta property="og:site_name"   content={APP_NAME} />

        {/* Twitter Card */}
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content={APP_NAME} />
        <meta name="twitter:description" content={DESCRIPTION} />
        <meta name="twitter:image"       content={OG_IMAGE} />

        {/* PWA / mobile */}
        <meta name="mobile-web-app-capable"       content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title"   content={APP_NAME} />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveBackground = `
html, body, #root {
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
}
body {
  background-color: #131313;
  color: #E5E2E1;
  margin: 0;
}
* {
  box-sizing: border-box;
}
`;
