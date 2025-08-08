import { AddressInfo, createServer } from 'node:net'

export const findAvailablePort = async () => {
  return new Promise<number>((resolve, reject) => {
    let port = 0
    const server = createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, () => {
      port = (server.address() as AddressInfo).port
      server.close()
    })
    server.on('close', () => {
      resolve(port)
    })
  })
}
