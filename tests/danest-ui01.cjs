const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');let n=0;
const ok=(x)=>{assert.ok(x);n++};
const search=read('src/pages/search.tsx'),hero=read('src/components/home/hero.tsx'),card=read('src/components/ui/listing-card.tsx'),detail=read('src/pages/apartment-detail.tsx'),cost=read('src/components/detail/cost-breakdown.tsx'),gallery=read('src/components/detail/gallery.tsx'),compare=read('src/components/saved/comparison-table.tsx'),footer=read('src/components/layout/footer.tsx');
const rgb=s=>s.match(/.{2}/g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
const lum=s=>rgb(s).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
for(const [a,b] of [['172C3D','F7F5F0'],['365844','E9EFE9'],['735826','F2EBDF'],['595952','F0EFEC'],['D9D7CF','172C3D'],['845820','F1F3EF']]){const x=lum(a),y=lum(b);ok((Math.max(x,y)+.05)/(Math.min(x,y)+.05)>=4.5);}
for(const [s,token] of [[search,'d.showModal()'],[search,'trigger?.focus()'],[search,'chips.map(c=>'],[search,'router.navigate(target,{replace:true,scroll:false})'],[search,'view: "map"'],[hero,'buildSearchUrl({'],[card,'listing.sponsored ?'],[card,'bg-[#F2EBDF]'],[card,'bg-[#E9EFE9]'],[detail,'AMENITY_ICON[a]??CircleCheck'],[detail,'<NearbyMap'],[detail,'recordListingView(trackId)'],[detail,'<ContactCard listing={listing}'],[cost,'estimateUsage(listing,quantities)'],[cost,'summary.estimatedMonthly-summary.confirmedMonthly'],[cost,'summary.unknownItems.length>0'],[gallery,'if(!shots.length)'],[gallery,'<PhotoViewer images={shots}'],[compare,'withValues.length !== listings.length'],[footer,'to="/stay-guide"']])ok(s.includes(token));
ok(!search.includes('lg:col-span-3 lg:block'));
ok(!gallery.includes('/images/l1.jpg'));
console.log(`PASS: ${n} UI01 color contrast and source integration assertions (offline; not browser tests).`);
