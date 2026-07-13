export namespace drive {
	
	export class Item {
	    id: string;
	    name: string;
	    isFolder: boolean;
	    size: number;
	
	    static createFrom(source: any = {}) {
	        return new Item(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.isFolder = source["isFolder"];
	        this.size = source["size"];
	    }
	}

}

export namespace filetree {
	
	export class LocalFile {
	    path: string;
	    name: string;
	    sizeBytes: number;
	    isPdf: boolean;
	    pageCount: number;
	    corrupt: boolean;
	
	    static createFrom(source: any = {}) {
	        return new LocalFile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.name = source["name"];
	        this.sizeBytes = source["sizeBytes"];
	        this.isPdf = source["isPdf"];
	        this.pageCount = source["pageCount"];
	        this.corrupt = source["corrupt"];
	    }
	}
	export class LocalFileGroup {
	    name: string;
	    files: LocalFile[];
	    subgroups: LocalFileGroup[];
	
	    static createFrom(source: any = {}) {
	        return new LocalFileGroup(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.files = this.convertValues(source["files"], LocalFile);
	        this.subgroups = this.convertValues(source["subgroups"], LocalFileGroup);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace pdf {
	
	export class OutputFileSpec {
	    pages: number[];
	    name: string;
	    outDir: string;
	
	    static createFrom(source: any = {}) {
	        return new OutputFileSpec(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pages = source["pages"];
	        this.name = source["name"];
	        this.outDir = source["outDir"];
	    }
	}

}

