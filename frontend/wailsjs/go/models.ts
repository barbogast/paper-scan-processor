export namespace main {
	
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

