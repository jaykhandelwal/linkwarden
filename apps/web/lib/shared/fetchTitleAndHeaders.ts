import fetch from "node-fetch";
import https from "https";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";

export default async function fetchTitleAndHeaders(url: string) {
  if (!url?.startsWith("http://") && !url?.startsWith("https://"))
    return { title: "", description: "", headers: null };

  try {
    const httpsAgent = new https.Agent({
      rejectUnauthorized:
        process.env.IGNORE_UNAUTHORIZED_CA === "true" ? false : true,
    });

    // fetchOpts allows a proxy to be defined
    let fetchOpts = {
      agent: httpsAgent,
    };

    if (process.env.PROXY) {
      // parse proxy url
      let proxy = new URL(process.env.PROXY);
      // if authentication set, apply to proxy URL
      if (process.env.PROXY_USERNAME) {
        proxy.username = process.env.PROXY_USERNAME;
        proxy.password = process.env.PROXY_PASSWORD || "";
      }

      const proxyAgent = proxy.protocol.includes("http")
        ? HttpsProxyAgent
        : SocksProxyAgent;

      // add socks5/http/https proxy to fetchOpts
      fetchOpts = { agent: new proxyAgent(proxy.toString()) };
    }

    const responsePromise = fetch(url, fetchOpts);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("Fetch title timeout"));
      }, 10 * 1000); // Stop after 10 seconds
    });

    const response = await Promise.race([responsePromise, timeoutPromise]);

    if ((response as any)?.status) {
      const text = await (response as any).text();

      // regular expression to find the <title> tag
      let titleMatch = text.match(/<title.*>([^<]*)<\/title>/);
      
      // More robust regex patterns for meta description
      // Pattern 1: name="description" content="..."
      let descriptionMatch = text.match(/<meta[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*>/i);
      
      // Pattern 2: content="..." name="description"
      if (!descriptionMatch) {
        descriptionMatch = text.match(/<meta[^>]*content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']description["'][^>]*>/i);
      }
      
      // Pattern 3: property="og:description" content="..."
      if (!descriptionMatch) {
        descriptionMatch = text.match(/<meta[^>]*property\s*=\s*["']og:description["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*>/i);
      }
      
      // Pattern 4: content="..." property="og:description"
      if (!descriptionMatch) {
        descriptionMatch = text.match(/<meta[^>]*content\s*=\s*["']([^"']*)["'][^>]*property\s*=\s*["']og:description["'][^>]*>/i);
      }

      const title = titleMatch?.[1] || "";
      const description = descriptionMatch?.[1] || "";
      const headers = (response as Response)?.headers || null;

      // Debug logging
      console.log("🔍 fetchTitleAndHeaders Debug:");
      console.log("URL:", url);
      console.log("Title found:", title);
      console.log("Description found:", description);
      console.log("Description match:", descriptionMatch);

      return { title, description, headers };
    } else {
      console.log("❌ fetchTitleAndHeaders: No response status");
      return { title: "", description: "", headers: null };
    }
  } catch (err) {
    console.log("❌ fetchTitleAndHeaders Error:", err);
    return { title: "", description: "", headers: null };
  }
}
