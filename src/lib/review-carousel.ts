export function reviewSlideIndex(index:number,step:number,total:number){
 if(total<1)return 0;
 return ((index+step)%total+total)%total;
}
