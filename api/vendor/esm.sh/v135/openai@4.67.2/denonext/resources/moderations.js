/* esm.sh - esbuild bundle(openai@4.67.2/resources/moderations) denonext production */
import{APIResource as s}from"/v135/openai@4.67.2/denonext/resource.js";var e=class extends s{create(o,r){return this._client.post("/moderations",{body:o,...r})}};e||(e={});export{e as Moderations};
//# sourceMappingURL=moderations.js.map