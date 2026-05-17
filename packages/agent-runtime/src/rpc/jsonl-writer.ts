export function createJsonLineWriter(output: NodeJS.WritableStream) {
  return {
    write(value: unknown): Promise<void> {
      return new Promise((resolve, reject) => {
        output.write(`${JSON.stringify(value)}\n`, (error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };
}
