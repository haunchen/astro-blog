import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

/**
 * 已發佈文章的單一取得管道。
 *
 * 「哪些文章該對外可見」原本沒有單一來源：`!data.draft` 這個述詞散在 15 個呼叫點
 * （頁面、列表、RSS、llms.txt、OG 圖、md 變體），新增端點時漏寫不會有任何東西擋下來，
 * 草稿就這樣靜默外流。判準只有一份，就只該寫在一個地方。
 *
 * 只驗得到「這裡漏了」的防線在 verify-seo 的「草稿文章不得產出 .md 變體」——那條只涵蓋
 * md 端點，其餘 14 個呼叫點沒有對應斷言。故本函式是實質防線，不是風格整理。
 */
export function getPublishedPosts(): Promise<Post[]> {
  return getCollection('posts', ({ data }) => !data.draft);
}

/**
 * 已發佈文章，依日期新到舊排序。
 *
 * 六個呼叫點（首頁、RSS、llms.txt、首頁 md、文章頁的前後篇與相關文章）各自寫過一次
 * 同樣的比較函式。回傳的是本函式自己的陣列，呼叫端再 sort/slice 都不會影響其他人。
 */
export async function getPublishedPostsByDateDesc(): Promise<Post[]> {
  const posts = await getPublishedPosts();
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}
