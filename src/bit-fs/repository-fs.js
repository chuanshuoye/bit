/** @flow */
import * as mkdirp from 'mkdirp';
import * as fs from 'fs';
import * as path from 'path';
import { BIT_DIR_NAME, BIT_IMPORTED_DIRNAME, BIT_INLINE_DIRNAME, BIT_JSON } from '../constants';

export default class RepositoryFs {

  /**
   * @private
   **/
  static composeRepoPath(p: string): string {
    return path.join(p, BIT_DIR_NAME);
  }

  static composeBitInlinePath(repoPath: string, name: string) {
    return path.join(repoPath, BIT_DIR_NAME, BIT_INLINE_DIRNAME, name);
  }

  static composeFileName(name: string) {
    return `${name}.js`;
  }

  static createBit(bitName: string, repoPath: string) {
    const bitPath = this.composeBitInlinePath(repoPath, bitName);
    mkdirp.sync(bitPath);
    fs.writeFileSync(path.join(bitPath, this.composeFileName(bitName)), fs.readFileSync(path.resolve(__dirname, '../../resources/impl.template.js')));
    
    return bitPath;
  }

  static bitExists(bitName: string, repoPath: string) {
    return fs.existsSync(this.composeBitInlinePath(repoPath, bitName));
  }

  /**
   * @private
   **/
  static composePath(p: string, inPath: string) {
    return path.join(this.composeRepoPath(p), inPath); 
  }

  /**
   * @private
   **/
  static createDir(p: string, inPath: string) {
    return mkdirp.sync(this.composePath(p, inPath));
  }

  static createRepo(p: string): boolean {
    if (this.pathHasRepo(p)) return false;

    this.createBitJson(p);
    this.createDir(p, BIT_IMPORTED_DIRNAME);
    this.createDir(p, BIT_INLINE_DIRNAME);
    return true;
  }

  static createBitJson(p: string) {
    if (this.hasBitJson(p)) return false;
    return fs.writeFileSync(
      this.composeBitJsonPath(p), 
      JSON.stringify(fs.readFileSync(path.resolve(__dirname, '../../resources/bit.template.json')).toString())
    );
  }

  /**
   * @private
   **/
  static composeBitJsonPath(p: string) {
    return path.join(p, BIT_JSON);
  }

  static hasBitJson(p: string): boolean {
    return fs.existsSync(this.composeBitJsonPath(p));
  }

  /**
   * @private
   **/
  static pathHasRepo(p: string): boolean {
    return fs.existsSync(this.composeRepoPath(p));
  }

  static locateClosestRepo(absPath: string): ?string {
    function buildPropogationPaths(): string[] {
      const paths: string[] = [];
      const pathParts = absPath.split(path.sep);
      
      pathParts.forEach((val, index) => {
        const part = pathParts.slice(0, index).join('/');
        if (!part) return;
        paths.push(part);
      });

      return paths.reverse();
    }

    if (this.pathHasRepo(absPath)) return absPath;
    const searchPaths = buildPropogationPaths();
    return searchPaths.find(searchPath => this.pathHasRepo(searchPath));     
  }
}
