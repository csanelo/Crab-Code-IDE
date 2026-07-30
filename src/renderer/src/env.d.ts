/// <reference types="vite/client" />

declare module '*?worker' {
  const workerConstructor: {
    new (options?: WorkerOptions): Worker
  }
  export default workerConstructor
}
