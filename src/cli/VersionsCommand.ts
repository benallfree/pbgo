import { Command } from 'commander'

async function listDockerHubTags(namespace: string, repository: string): Promise<string[]> {
  let page = 1
  const pageSize = 100
  let allTags: string[] = []
  try {
    while (true) {
      const url = `https://registry.hub.docker.com/v2/namespaces/${namespace}/repositories/${repository}/tags?page_size=${pageSize}&page=${page}`
      const response = await fetch(url, { headers: { 'Content-Type': 'application/json' } })
      if (!response.ok) {
        if (response.status === 404) break
        throw new Error(`HTTP error! Status: ${response.status}`)
      }
      const data = (await response.json()) as { results?: Array<{ name: string }> }
      if (!data.results || data.results.length === 0) break
      const tags = data.results.map((tag) => tag.name)
      allTags = allTags.concat(tags)
      page++
    }
    return allTags
  } catch (_) {
    return []
  }
}

async function handleVersions() {
  console.log('Fetching available PocketBase versions from Docker Hub...')
  const tags = await listDockerHubTags('benallfree', 'pocketbase')
  if (tags.length > 0) {
    console.log('Available PocketBase versions:')
    for (const tag of tags) console.log(`  ${tag}`)
  } else {
    console.log('No versions found or error occurred')
  }
}

export const VersionsCommand = () => {
  return new Command(`versions`).description('List available PocketBase Docker tags').action(async () => {
    await handleVersions()
  })
}
