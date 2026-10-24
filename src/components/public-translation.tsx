'use client';
import {createContext,useContext,useEffect,type ReactNode} from 'react';
import type {PublicLocale} from '@/lib/public-content';
import {translatePublicTree} from '@/lib/i18n/public-tree';
const PublicLanguage=createContext<PublicLocale>('ko');
export function PublicLanguageProvider({locale,children}:{locale:PublicLocale;children:ReactNode}){
 useEffect(()=>{document.documentElement.lang=locale;},[locale]);
 return <PublicLanguage.Provider value={locale}>{children}</PublicLanguage.Provider>;
}
/** No extra DOM: Korean content is returned unchanged; English uses the same tree. */
export function Localized({children}:{children:ReactNode}){return useContext(PublicLanguage)==='en'?translatePublicTree(children):children;}
