import os from 'os';
import path from 'path';
import { pipeline, Transform } from 'stream'
import { access, readFile, writeFile, rename, lstat, unlink } from 'node:fs/promises'
import { readdir, createReadStream, createWriteStream } from 'fs';
import { createHash } from 'node:crypto';
import { createGzip, createGunzip } from 'node:zlib';

const username = process.argv.slice(2)[0].split('=')[1]
console.log(`Welcome to the File Manager, ${username}!`)

export let currentPath = os.homedir()

console.log(`You are currently in ${currentPath}`)

const readable = process.stdin
const writable = process.stdout

const printCurrentPath = () => `You are currently in ${currentPath}\n`
const printOperationFailed = () => 'Operation failed\n'

const main = async () => {
  const transform = new Transform({
    async transform(chunk, enc, cb) {
      const input = chunk.toString().trim().split(' ')
      const pathOne = input[1] ? path.resolve(currentPath, input[1]) : undefined
      const pathTwo = input[2] ? path.resolve(currentPath, input[2]) : undefined

      if (input[0] === 'up' && input.length === 1) {
        let oneStepBack = path.join(currentPath, '../')
        currentPath = oneStepBack

        this.push(printCurrentPath())
      }

      else if (input[0] === 'cd' && pathOne && !pathTwo) {
        try {
          await access(pathOne);
          const possibleDirectory = await lstat(pathOne)
          if (possibleDirectory.isDirectory()) {
            currentPath = pathOne
          } else {
            throw new Error()
          }
        } catch (error) {
          this.push(printOperationFailed())
        } finally {
          this.push(printCurrentPath())
        }
      }

      else if (input[0] === 'ls' && input.length === 1) {
        readdir(currentPath, { withFileTypes: true }, (err, files) => {
          const filesArr = []
          files.forEach((file) => {
            file.isFile() ? filesArr.push({ Name: file.name, Type: 'file' }) : filesArr.push({ Name: file.name, Type: 'directory' })
          })
          console.table(filesArr);

          this.push(printCurrentPath())
        });
      }

      else if (input[0] === 'cat' && pathOne && !pathTwo) {
        try {
          const contents = await readFile(pathOne, { encoding: 'utf8' });
          console.log(contents);
        } catch (err) {
          this.push(printOperationFailed())
        } finally {
          this.push(printCurrentPath())
        }
      }

      else if (input[0] === 'add' && pathOne && !pathTwo) {
        try {
          await writeFile(pathOne, '', { flag: 'wx' })
        } catch (err) {
          this.push(printOperationFailed())
        } finally {
          this.push(printCurrentPath())
        }
      }

      else if (input[0] === 'rn' && pathOne && pathTwo) {
        try {
          await rename(pathOne, pathTwo)
        } catch (err) {
          this.push(printOperationFailed())
        } finally {
          this.push(printCurrentPath())
        }
      }

      else if (input[0] === 'cp' && pathOne && pathTwo) {
        const readable = createReadStream(pathOne, { encoding: 'utf8' });
        const writable = createWriteStream(pathTwo);

        readable
          .on('error', () => this.push(printOperationFailed() + printCurrentPath()))
          .pipe(writable)
          .on('error', () => this.push(printOperationFailed() + printCurrentPath()))
          .on('finish', () => this.push(printCurrentPath()))
      }

      else if (input[0] === 'mv' && pathOne && pathTwo) {
        const readable = createReadStream(pathOne, { encoding: 'utf8' });
        const writable = createWriteStream(pathTwo);

        readable
          .on('error', () => this.push(printOperationFailed() + printCurrentPath()))
          .pipe(writable)
          .on('error', () => this.push(printOperationFailed() + printCurrentPath()))
          .on('finish', async () => {
            try {
              await unlink(pathOne)
            } catch (err) {
              this.push(printOperationFailed())
            } finally {
              this.push(printCurrentPath())
            }
          })
      }

      else if (input[0] === 'rm' && pathOne && !pathTwo) {
        try {
          await unlink(pathOne)
        } catch (err) {
          this.push(printOperationFailed())
        } finally {
          this.push(printCurrentPath())
        }
      }

      else if (input[0] === 'os' && input.length === 2) {
        switch (input[1]) {
          case '--EOL':
            this.push(JSON.stringify(os.EOL) + '\n')
            break;
          case '--cpus':
            os.cpus().forEach(el => this.push(el.model + '\n'))
            break
          case '--homedir':
            this.push(os.homedir() + '\n')
            break
          case '--username':
            this.push(os.userInfo().username + '\n')
            break
          case '--architecture':
            this.push(os.arch() + '\n')
            break
          default:
            this.push(`Invalid input\n`)
            break;
        }
        this.push(printCurrentPath())
      }

      else if (input[0] === 'hash' && pathOne && !pathTwo) {
        try {
          const contents = await readFile(pathOne, { encoding: 'utf8' });
          const result = createHash('sha256').update(contents).digest('hex');
          this.push(result + '\n');
        } catch (err) {
          this.push(printOperationFailed())
        } finally {
          this.push(printCurrentPath())
        }
      }

      else if (input[0] === 'compress' && pathOne && pathTwo) {
        const gzip = createGzip();
        const source = createReadStream(pathOne);
        const destination = createWriteStream(pathTwo);
        pipeline(source, gzip, destination, (err) => {
          if (err) {
            this.push(printOperationFailed())
          }
        }).on('finish', () => this.push(printCurrentPath()))
      }

      else if (input[0] === 'decompress' && pathOne && pathTwo) {
        const unzip = createGunzip();
        const source = createReadStream(pathOne);
        const destination = createWriteStream(pathTwo);
        pipeline(source, unzip, destination, (err) => {
          if (err) {
            this.push(printOperationFailed())
          }
        }).on('finish', () => this.push(printCurrentPath()))
      }

      else if (input[0] === '.exit' && input.length === 1) {
        this.push(`Thank you for using File Manager, ${username}, goodbye!`)
        process.exit()
      }

      else {
        this.push(`Invalid input\n`)
        this.push(printCurrentPath())
      }

      cb()
    }
  })


  pipeline(readable, transform, writable,
    err => {
      console.log(err)
    }
  )
};

process.on('SIGINT', () => {
  console.log(`Thank you for using File Manager, ${username}, goodbye!`)
  process.exit()
})

main()