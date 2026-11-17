import type {HistoryPhoto} from '@/app/(public)/history/history-data';
import data from './data.json';

/** Curated official Instagram photos. Date is a sorting anchor; show the poster label. */
export function instagramHistoryPhotos(locale:'ko'|'en'):HistoryPhoto[]{
 return data.map(album=>({
  id:album.id,category:'regular',cohort:album.cohort,
  title:album.title[locale],description:album.description[locale],
  date:album.sortDate,src:album.photos[0].src,alt:album.photos[0].alt[locale],
  archive:{periodLabel:album.schedule.label[locale],posterUrl:album.schedule.posterUrl,posterSrc:album.schedule.posterSrc},
  slidePhotos:album.photos.map(photo=>({src:photo.src,alt:photo.alt[locale],sourceUrl:photo.sourceUrl})),
 }));
}
