import { BrandLogo } from '@/components/brand-logo';

/** Remove near-white backing at render time without redrawing the brand asset. */
export function PartyLogo() {
  return <>
    <svg className="hw-logo-filter" aria-hidden="true" focusable="false">
      <defs><filter id="hw-logo-cutout" colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -20 -20 -20 0 59"/>
      </filter></defs>
    </svg>
    <BrandLogo compact/>
  </>;
}
