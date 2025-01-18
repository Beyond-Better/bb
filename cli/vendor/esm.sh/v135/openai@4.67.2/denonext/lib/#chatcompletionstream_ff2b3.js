/* esm.sh - esbuild bundle(openai@4.67.2/lib/ChatCompletionStream) denonext production */
import{OpenAIError as d,APIUserAbortError as Q,LengthFinishReasonError as X,ContentFilterFinishReasonError as B}from"/v135/openai@4.67.2/denonext/error.js";import{AbstractChatCompletionRunner as K}from"/v135/openai@4.67.2/denonext/lib/AbstractChatCompletionRunner.js";import{Stream as z}from"/v135/openai@4.67.2/denonext/streaming.js";import{hasAutoParseableInput as V,isAutoParsableResponseFormat as Y,isAutoParsableTool as Z,maybeParseChatCompletion as tt,shouldParseToolCall as et}from"/v135/openai@4.67.2/denonext/lib/parser.js";import{partialParse as H}from"/v135/openai@4.67.2/denonext/_vendor/partial-json-parser/parser.js";var F=function(i,s,t,n,o){if(n==="m")throw new TypeError("Private method is not writable");if(n==="a"&&!o)throw new TypeError("Private accessor was defined without a setter");if(typeof s=="function"?i!==s||!o:!s.has(i))throw new TypeError("Cannot write private member to an object whose class did not declare it");return n==="a"?o.call(i,t):o?o.value=t:s.set(i,t),t},r=function(i,s,t,n){if(t==="a"&&!n)throw new TypeError("Private accessor was defined without a getter");if(typeof s=="function"?i!==s||!n:!s.has(i))throw new TypeError("Cannot read private member from an object whose class did not declare it");return t==="m"?n:t==="a"?n.call(i):n?n.value:s.get(i)},c,C,x,v,M,D,W,L,N,I,G,J,U=class i extends K{constructor(s){super(),c.add(this),C.set(this,void 0),x.set(this,void 0),v.set(this,void 0),F(this,C,s,"f"),F(this,x,[],"f")}get currentChatCompletionSnapshot(){return r(this,v,"f")}static fromReadableStream(s){let t=new i(null);return t._run(()=>t._fromReadableStream(s)),t}static createChatCompletion(s,t,n){let o=new i(t);return o._run(()=>o._runChatCompletion(s,{...t,stream:!0},{...n,headers:{...n?.headers,"X-Stainless-Helper-Method":"stream"}})),o}async _createChatCompletion(s,t,n){super._createChatCompletion;let o=n?.signal;o&&(o.aborted&&this.controller.abort(),o.addEventListener("abort",()=>this.controller.abort())),r(this,c,"m",M).call(this);let e=await s.chat.completions.create({...t,stream:!0},{...n,signal:this.controller.signal});this._connected();for await(let l of e)r(this,c,"m",W).call(this,l);if(e.controller.signal?.aborted)throw new Q;return this._addChatCompletion(r(this,c,"m",I).call(this))}async _fromReadableStream(s,t){let n=t?.signal;n&&(n.aborted&&this.controller.abort(),n.addEventListener("abort",()=>this.controller.abort())),r(this,c,"m",M).call(this),this._connected();let o=z.fromReadableStream(s,this.controller),e;for await(let l of o)e&&e!==l.id&&this._addChatCompletion(r(this,c,"m",I).call(this)),r(this,c,"m",W).call(this,l),e=l.id;if(o.controller.signal?.aborted)throw new Q;return this._addChatCompletion(r(this,c,"m",I).call(this))}[(C=new WeakMap,x=new WeakMap,v=new WeakMap,c=new WeakSet,M=function(){this.ended||F(this,v,void 0,"f")},D=function(t){let n=r(this,x,"f")[t.index];return n||(n={content_done:!1,refusal_done:!1,logprobs_content_done:!1,logprobs_refusal_done:!1,done_tool_calls:new Set,current_tool_call_index:null},r(this,x,"f")[t.index]=n,n)},W=function(t){if(this.ended)return;let n=r(this,c,"m",J).call(this,t);this._emit("chunk",t,n);for(let o of t.choices){let e=n.choices[o.index];o.delta.content!=null&&e.message?.role==="assistant"&&e.message?.content&&(this._emit("content",o.delta.content,e.message.content),this._emit("content.delta",{delta:o.delta.content,snapshot:e.message.content,parsed:e.message.parsed})),o.delta.refusal!=null&&e.message?.role==="assistant"&&e.message?.refusal&&this._emit("refusal.delta",{delta:o.delta.refusal,snapshot:e.message.refusal}),o.logprobs?.content!=null&&e.message?.role==="assistant"&&this._emit("logprobs.content.delta",{content:o.logprobs?.content,snapshot:e.logprobs?.content??[]}),o.logprobs?.refusal!=null&&e.message?.role==="assistant"&&this._emit("logprobs.refusal.delta",{refusal:o.logprobs?.refusal,snapshot:e.logprobs?.refusal??[]});let l=r(this,c,"m",D).call(this,e);e.finish_reason&&(r(this,c,"m",N).call(this,e),l.current_tool_call_index!=null&&r(this,c,"m",L).call(this,e,l.current_tool_call_index));for(let u of o.delta.tool_calls??[])l.current_tool_call_index!==u.index&&(r(this,c,"m",N).call(this,e),l.current_tool_call_index!=null&&r(this,c,"m",L).call(this,e,l.current_tool_call_index)),l.current_tool_call_index=u.index;for(let u of o.delta.tool_calls??[]){let g=e.message.tool_calls?.[u.index];g?.type&&(g?.type==="function"?this._emit("tool_calls.function.arguments.delta",{name:g.function?.name,index:u.index,arguments:g.function.arguments,parsed_arguments:g.function.parsed_arguments,arguments_delta:u.function?.arguments??""}):(g?.type,void 0))}}},L=function(t,n){if(r(this,c,"m",D).call(this,t).done_tool_calls.has(n))return;let e=t.message.tool_calls?.[n];if(!e)throw new Error("no tool call snapshot");if(!e.type)throw new Error("tool call snapshot missing `type`");if(e.type==="function"){let l=r(this,C,"f")?.tools?.find(u=>u.type==="function"&&u.function.name===e.function.name);this._emit("tool_calls.function.arguments.done",{name:e.function.name,index:n,arguments:e.function.arguments,parsed_arguments:Z(l)?l.$parseRaw(e.function.arguments):l?.function.strict?JSON.parse(e.function.arguments):null})}else e.type},N=function(t){let n=r(this,c,"m",D).call(this,t);if(t.message.content&&!n.content_done){n.content_done=!0;let o=r(this,c,"m",G).call(this);this._emit("content.done",{content:t.message.content,parsed:o?o.$parseRaw(t.message.content):null})}t.message.refusal&&!n.refusal_done&&(n.refusal_done=!0,this._emit("refusal.done",{refusal:t.message.refusal})),t.logprobs?.content&&!n.logprobs_content_done&&(n.logprobs_content_done=!0,this._emit("logprobs.content.done",{content:t.logprobs.content})),t.logprobs?.refusal&&!n.logprobs_refusal_done&&(n.logprobs_refusal_done=!0,this._emit("logprobs.refusal.done",{refusal:t.logprobs.refusal}))},I=function(){if(this.ended)throw new d("stream has ended, this shouldn't happen");let t=r(this,v,"f");if(!t)throw new d("request ended without sending any chunks");return F(this,v,void 0,"f"),F(this,x,[],"f"),nt(t,r(this,C,"f"))},G=function(){let t=r(this,C,"f")?.response_format;return Y(t)?t:null},J=function(t){var n,o,e,l;let u=r(this,v,"f"),{choices:g,...b}=t;u?Object.assign(u,b):u=F(this,v,{...b,choices:[]},"f");for(let{delta:E,finish_reason:f,index:R,logprobs:w=null,...j}of t.choices){let a=u.choices[R];if(a||(a=u.choices[R]={finish_reason:f,index:R,message:{},logprobs:w,...j}),w)if(!a.logprobs)a.logprobs=Object.assign({},w);else{let{content:S,refusal:y,...P}=w;Object.assign(a.logprobs,P),S&&((n=a.logprobs).content??(n.content=[]),a.logprobs.content.push(...S)),y&&((o=a.logprobs).refusal??(o.refusal=[]),a.logprobs.refusal.push(...y))}if(f&&(a.finish_reason=f,r(this,C,"f")&&V(r(this,C,"f")))){if(f==="length")throw new X;if(f==="content_filter")throw new B}if(Object.assign(a,j),!E)continue;let{content:T,refusal:A,function_call:h,role:$,tool_calls:_,...O}=E;if(Object.assign(a.message,O),A&&(a.message.refusal=(a.message.refusal||"")+A),$&&(a.message.role=$),h&&(a.message.function_call?(h.name&&(a.message.function_call.name=h.name),h.arguments&&((e=a.message.function_call).arguments??(e.arguments=""),a.message.function_call.arguments+=h.arguments)):a.message.function_call=h),T&&(a.message.content=(a.message.content||"")+T,!a.message.refusal&&r(this,c,"m",G).call(this)&&(a.message.parsed=H(a.message.content))),_){a.message.tool_calls||(a.message.tool_calls=[]);for(let{index:S,id:y,type:P,function:p,...q}of _){let m=(l=a.message.tool_calls)[S]??(l[S]={});Object.assign(m,q),y&&(m.id=y),P&&(m.type=P),p&&(m.function??(m.function={name:p.name??"",arguments:""})),p?.name&&(m.function.name=p.name),p?.arguments&&(m.function.arguments+=p.arguments,et(r(this,C,"f"),m)&&(m.function.parsed_arguments=H(m.function.arguments)))}}}return u},Symbol.asyncIterator)](){let s=[],t=[],n=!1;return this.on("chunk",o=>{let e=t.shift();e?e.resolve(o):s.push(o)}),this.on("end",()=>{n=!0;for(let o of t)o.resolve(void 0);t.length=0}),this.on("abort",o=>{n=!0;for(let e of t)e.reject(o);t.length=0}),this.on("error",o=>{n=!0;for(let e of t)e.reject(o);t.length=0}),{next:async()=>s.length?{value:s.shift(),done:!1}:n?{value:void 0,done:!0}:new Promise((e,l)=>t.push({resolve:e,reject:l})).then(e=>e?{value:e,done:!1}:{value:void 0,done:!0}),return:async()=>(this.abort(),{value:void 0,done:!0})}}toReadableStream(){return new z(this[Symbol.asyncIterator].bind(this),this.controller).toReadableStream()}};function nt(i,s){let{id:t,choices:n,created:o,model:e,system_fingerprint:l,...u}=i,g={...u,id:t,choices:n.map(({message:b,finish_reason:E,index:f,logprobs:R,...w})=>{if(!E)throw new d(`missing finish_reason for choice ${f}`);let{content:j=null,function_call:a,tool_calls:T,...A}=b,h=b.role;if(!h)throw new d(`missing role for choice ${f}`);if(a){let{arguments:$,name:_}=a;if($==null)throw new d(`missing function_call.arguments for choice ${f}`);if(!_)throw new d(`missing function_call.name for choice ${f}`);return{...w,message:{content:j,function_call:{arguments:$,name:_},role:h,refusal:b.refusal??null},finish_reason:E,index:f,logprobs:R}}return T?{...w,index:f,finish_reason:E,logprobs:R,message:{...A,role:h,content:j,refusal:b.refusal??null,tool_calls:T.map(($,_)=>{let{function:O,type:S,id:y,...P}=$,{arguments:p,name:q,...m}=O||{};if(y==null)throw new d(`missing choices[${f}].tool_calls[${_}].id
${k(i)}`);if(S==null)throw new d(`missing choices[${f}].tool_calls[${_}].type
${k(i)}`);if(q==null)throw new d(`missing choices[${f}].tool_calls[${_}].function.name
${k(i)}`);if(p==null)throw new d(`missing choices[${f}].tool_calls[${_}].function.arguments
${k(i)}`);return{...P,id:y,type:S,function:{...m,name:q,arguments:p}}})}}:{...w,message:{...A,content:j,role:h,refusal:b.refusal??null},finish_reason:E,index:f,logprobs:R}}),created:o,model:e,object:"chat.completion",...l?{system_fingerprint:l}:{}};return tt(g,s)}function k(i){return JSON.stringify(i)}export{U as ChatCompletionStream};
//# sourceMappingURL=ChatCompletionStream.js.map