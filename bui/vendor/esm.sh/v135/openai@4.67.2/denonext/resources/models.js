/* esm.sh - esbuild bundle(openai@4.67.2/resources/models) denonext production */
import{APIResource as i}from"/v135/openai@4.67.2/denonext/resource.js";import{Page as l}from"/v135/openai@4.67.2/denonext/pagination.js";var s=class extends i{retrieve(e,o){return this._client.get(`/models/${e}`,o)}list(e){return this._client.getAPIList("/models",t,e)}del(e,o){return this._client.delete(`/models/${e}`,o)}},t=class extends l{};(function(r){r.ModelsPage=t})(s||(s={}));export{s as Models,t as ModelsPage};
//# sourceMappingURL=models.js.map