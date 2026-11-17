import { isIP } from "node:net";
import { config } from "./config.js";

export function validateCommerceUrl(value:string):URL {
 const url=new URL(value);
 if(url.username||url.password||url.search||url.hash||url.pathname!=="/"&&url.pathname!=="")throw new Error("Use somente o endereço raiz da loja sem credenciais");
 if(url.protocol!=="https:" && !(process.env.NODE_ENV!=="production"&&url.protocol==="http:"&&url.hostname==="localhost")) throw new Error("A URL comercial deve usar HTTPS");
 if(isIP(url.hostname) || url.hostname==="localhost" && process.env.NODE_ENV==="production") throw new Error("Não é permitido usar IP ou localhost em produção");
 const allowed=config.ALLOWED_COMMERCE_HOSTS.split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
 if(!allowed.includes(url.hostname.toLowerCase()) && !(process.env.NODE_ENV!=="production"&&url.hostname==="localhost"))
  throw new Error("Domínio não autorizado. Configure ALLOWED_COMMERCE_HOSTS");
 return url;
}
