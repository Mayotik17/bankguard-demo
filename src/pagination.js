// Pure list window: filters and selection belong to the caller.
export function paginate(rows, page=1, size=20) {
 if (!Number.isInteger(size) || size < 1) throw new RangeError('Invalid page size');
 const pages=Math.max(1,Math.ceil(rows.length/size));
 const current=Math.min(pages,Math.max(1,Number.isInteger(page)?page:1));
 const start=(current-1)*size;
 return {items:rows.slice(start,start+size),page:current,pages,start,end:Math.min(rows.length,start+size),total:rows.length};
}
