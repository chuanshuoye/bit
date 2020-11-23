import { expose } from '@teambit/worker';
import { runCLI } from 'jest';

export class JestWorker {
  private onTestCompleteCb;

  onTestComplete(onTestComplete) {
    this.onTestCompleteCb = onTestComplete;
    return this;
  }

  watch(jestConfigPath: string, testFiles: string[], rootPath: string) {
    return new Promise((resolve) => {
      // eslint-disable-next-line
      const jestConfig = require(jestConfigPath);

      const jestConfigWithSpecs = Object.assign(jestConfig, {
        testMatch: testFiles,
      });

      const config: any = {
        // useStderr: true,
        silent: true,
        rootDir: rootPath,
        watch: true,
        watchAll: true,
        watchPlugins: [
          [
            `${__dirname}/watch.js`,
            {
              specFiles: testFiles,
              onComplete: (results) => {
                if (!this.onTestCompleteCb) return;
                this.onTestCompleteCb(results);
              },
            },
          ],
        ],
      };

      const withEnv = Object.assign(jestConfigWithSpecs, config);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      const res = runCLI(withEnv, [jestConfigPath]);
      // eslint-disable-next-line no-console
      res.catch((err) => console.error(err));
      resolve();
    });
  }
}

expose(new JestWorker());
