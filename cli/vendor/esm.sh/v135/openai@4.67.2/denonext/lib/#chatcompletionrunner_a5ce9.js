/* esm.sh - esbuild bundle(openai@4.67.2/lib/ChatCompletionRunner) denonext production */
import{AbstractChatCompletionRunner as c}from"/v135/openai@4.67.2/denonext/lib/AbstractChatCompletionRunner.js";import{isAssistantMessage as a}from"/v135/openai@4.67.2/denonext/lib/chatCompletionUtils.js";var u=class o extends c{static runFunctions(n,e,r){let t=new o,s={...r,headers:{...r?.headers,"X-Stainless-Helper-Method":"runFunctions"}};return t._run(()=>t._runFunctions(n,e,s)),t}static runTools(n,e,r){let t=new o,s={...r,headers:{...r?.headers,"X-Stainless-Helper-Method":"runTools"}};return t._run(()=>t._runTools(n,e,s)),t}_addMessage(n,e=!0){super._addMessage(n,e),a(n)&&n.content&&this._emit("content",n.content)}};export{u as ChatCompletionRunner};
//# sourceMappingURL=ChatCompletionRunner.js.map