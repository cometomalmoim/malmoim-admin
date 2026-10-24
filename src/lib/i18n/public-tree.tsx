import {Suspense,Children,cloneElement,isValidElement,type ReactNode} from 'react';
import {localizedPublicPath,isLocalizedPublicPath} from '@/lib/public-locale';
import {englishPublicText} from '@/lib/i18n/about-history';
export function translatePublicTree(node:ReactNode):ReactNode{
 if(typeof node==='string')return englishPublicText(node);
 if(!isValidElement<Record<string,unknown>>(node))return node;
 if(node.props['data-i18n-skip'])return node;
 // Never inspect deferred server children outside their streaming boundary.
 if(node.type===Suspense)return cloneElement(node,{fallback:translatePublicTree(node.props.fallback as ReactNode)});
 const props:Record<string,unknown>={};
 for(const key of ['alt','title','aria-label','placeholder'])if(!(key==='title'&&node.props.userTitle)&&typeof node.props[key]==='string')props[key]=englishPublicText(node.props[key] as string);
 const href=node.props.href;
 if(typeof href==='string'&&href.startsWith('/')&&!href.startsWith('//')){const match=href.match(/^([^?#]+)(.*)$/);if(match&&isLocalizedPublicPath(match[1]))props.href=localizedPublicPath(match[1],'en')+match[2];}
 const children=node.props.children as ReactNode;
 if(children!==undefined){const parts=Children.toArray(children);props.children=parts.length>0&&parts.every(p=>typeof p==='string'||typeof p==='number')?englishPublicText(parts.join('')):Children.map(children,translatePublicTree);}
 return cloneElement(node,props);
}
