import Head from 'next/head';
import Script from 'next/script';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import logo from '../public/logo.jpg';
import favicon from '../public/favicon.jpg';

export async function getStaticProps() {
  const html = await readFile(path.join(process.cwd(), 'public/index.html'), 'utf8');
  const styles = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  const loginScript = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  const markup = html.match(/<body>([\s\S]*?)<script type="module">/)[1].replace('/logo.jpg', logo.src);
  return { props: { styles, loginScript, markup } };
}

export default function Home({ styles, loginScript, markup }) {
  return <>
    <Head>
      <link rel="icon" type="image/jpeg" href={favicon.src} />
      <link rel="apple-touch-icon" href={favicon.src} />
      <title>Ingresar · Hay Lugar</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="theme-color" content="#faf6eb" />
      <meta name="description" content="Ingresá a Hay Lugar con tu cuenta de Google." />
      <style dangerouslySetInnerHTML={{ __html: styles + '\n#__next { display: contents; }' }} />
    </Head>
    <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: markup }} />
    <Script id="google-login" type="module" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: loginScript }} />
  </>;
}
