import {
  arweaveDataGatewayHost,
  fetchArweaveL1Graphql,
  normalizeArweaveTxId,
  resilientArweaveDataUrl,
} from './arweaveDataGateway';

export type Ans114Comment = {
  id: string;
  owner: string;
  body: string;
  dataSource: string;
  rootSource: string;
  createdAt?: number;
  height?: number;
  tags: { name: string; value: string }[];
};

export type CreateAns114CommentArgs = {
  body: string;
  dataSource: string;
  rootSource?: string;
  appVersion?: string;
  extraTags?: { name: string; value: string }[];
};

const COMMENT_MAX_CHARS = 1000;
const TX_ID_RE = /^[a-zA-Z0-9_-]{43}$/;

function assertTxId(value: string, label: string): string {
  const id = normalizeArweaveTxId(value);
  if (!TX_ID_RE.test(id)) throw new Error(`${label} must be a valid Arweave transaction id.`);
  return id;
}

function tagValue(tags: { name: string; value: string }[], name: string): string {
  return tags.find((tag) => tag.name === name)?.value?.trim() || '';
}

async function fetchCommentBody(id: string): Promise<string> {
  const res = await fetch(resilientArweaveDataUrl(id), {
    method: 'GET',
    headers: { Accept: 'text/plain, text/markdown;q=0.9, */*;q=0.1' },
  });
  if (!res.ok) throw new Error(`Comment body unavailable (${res.status})`);
  return (await res.text()).trim();
}

export async function listAns114Comments(rootSource: string): Promise<Ans114Comment[]> {
  const rootId = assertTxId(rootSource, 'Root source');
  const query = `
    query StreamVaultAns114Comments($tags: [TagFilter!], $first: Int!) {
      transactions(tags: $tags, first: $first, sort: HEIGHT_ASC) {
        edges {
          node {
            id
            owner { address }
            block { height timestamp }
            tags { name value }
          }
        }
      }
    }
  `;
  const json = await fetchArweaveL1Graphql({
    query,
    variables: {
      first: 50,
      tags: [
        { name: 'Data-Protocol', values: ['comment'] },
        { name: 'Root-Source', values: [rootId] },
      ],
    },
    timeoutMs: 6000,
  });

  const nodes: any[] = json?.data?.transactions?.edges?.map((edge: any) => edge?.node).filter(Boolean) || [];
  const comments = await Promise.all(
    nodes.map(async (node): Promise<Ans114Comment | null> => {
      const tags = Array.isArray(node.tags) ? node.tags : [];
      const id = String(node.id || '');
      const dataSource = tagValue(tags, 'Data-Source');
      const indexedRootSource = tagValue(tags, 'Root-Source') || dataSource;
      if (!TX_ID_RE.test(id) || indexedRootSource !== rootId || !dataSource) return null;
      try {
        const body = await fetchCommentBody(id);
        if (!body) return null;
        return {
          id,
          owner: String(node.owner?.address || ''),
          body,
          dataSource,
          rootSource: indexedRootSource,
          createdAt: Number(node.block?.timestamp || 0) || undefined,
          height: Number(node.block?.height || 0) || undefined,
          tags,
        };
      } catch {
        return {
          id,
          owner: String(node.owner?.address || ''),
          body: 'Comment indexed. Body is still propagating across gateways.',
          dataSource,
          rootSource: indexedRootSource,
          createdAt: Number(node.block?.timestamp || 0) || undefined,
          height: Number(node.block?.height || 0) || undefined,
          tags,
        };
      }
    })
  );

  return comments.filter(Boolean) as Ans114Comment[];
}

export async function createAns114Comment(args: CreateAns114CommentArgs): Promise<string> {
  const body = String(args.body || '').trim();
  if (!body) throw new Error('Comment cannot be empty.');
  if (body.length > COMMENT_MAX_CHARS) {
    throw new Error(`Comment must be ${COMMENT_MAX_CHARS} characters or fewer.`);
  }

  const dataSource = assertTxId(args.dataSource, 'Data source');
  const rootSource = args.rootSource ? assertTxId(args.rootSource, 'Root source') : dataSource;
  const wallet = typeof window !== 'undefined' ? (window as any).arweaveWallet : null;
  if (!wallet?.sign) throw new Error('Connect Wander to post a comment.');

  const Arweave = (await import('arweave')).default;
  const arweave = Arweave.init(arweaveDataGatewayHost());
  const tx = await arweave.createTransaction({ data: body });
  const tags = [
    { name: 'Content-Type', value: 'text/plain' },
    { name: 'Data-Protocol', value: 'comment' },
    { name: 'Data-Source', value: dataSource },
    { name: 'Root-Source', value: rootSource },
    { name: 'App-Name', value: 'StreamVault' },
    { name: 'App-Version', value: args.appVersion || 'alpha' },
    ...(args.extraTags || []),
  ];
  tags.forEach((tag) => tx.addTag(tag.name, tag.value));

  const signedTx = await wallet.sign(tx);
  const txToPost = signedTx || tx;
  const response = await arweave.transactions.post(txToPost as any);
  if (response.status >= 400) throw new Error(`Comment upload failed: ${response.status}`);
  return String((txToPost as any).id || tx.id);
}

export function ans114CommentMaxChars(): number {
  return COMMENT_MAX_CHARS;
}
