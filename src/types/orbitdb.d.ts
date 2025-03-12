declare module '@orbitdb/core' {
  export function createOrbitDB(options: any): any;
  export function IPFSAccessController(options: any): any;
}

declare module '@orbitdb/voyager' {
  export class Voyager {
    constructor(options: any);
    add(address: string): void;
  }
} 