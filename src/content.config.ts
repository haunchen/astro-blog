import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string().min(1).max(60, '標題不可超過 60 字（SEO 限制）'),
        date: z.date(),
        updated: z.date().optional(),
        description: z.string().max(160, '描述不可超過 160 字（SEO 限制）'),
        category: z.enum(['n8n', 'flutter', 'devops', 'raspberry-pi', 'tools', 'hardware']),
        tags: z.array(z.string()).default([]),
        cover: image(),
        draft: z.boolean().default(false),
        // 排程發布日。有值且 draft 為真時，publish-scheduled 到期會把 draft 翻掉並把
        // date 改寫成這個值。沒有這個欄位的草稿永遠不會被自動發布。
        // z.coerce 與上面的 date 一致，讓 YAML 的裸日期字串也能過。
        publishAt: z.coerce.date().optional(),
        // 更新紀錄。發布後改過內容就補一列，新到舊。它回答的是「這篇改了什麼」，
        // 不是「改成什麼」——後者是正文的工作。只有一個 updated 日期時，讀者無從得知
        // 改的是錯字還是結論，這一行就是補那個缺口。
        // 60 字上限是硬逼出一句話：寫得下細節，這裡就會長成第二篇文章。
        changelog: z
          .array(
            z.object({
              date: z.coerce.date(),
              note: z.string().min(1).max(60, '單則更新說明不可超過 60 字（一句話講完改了什麼）'),
            }),
          )
          .optional(),
      })
      // 人手動排程時最容易犯的錯就是只加 publishAt、忘了 draft: true——那樣文章下次
      // build 就直接上站，正是這個功能存在的目的的反面。翻牌後 publishAt 整行被刪，
      // 所以這條 refine 不會反過來卡住已發布的文章。
      .refine((post) => post.publishAt === undefined || post.draft === true, {
        message: '排程文章必須同時標 draft: true',
        path: ['draft'],
      })
      // `updated` 只描述「已上線的文章被改過」。還沒發布的稿子沒有讀者看過的舊版本，
      // 那個日期就只能是寫作過程的殘留——vault 的同名欄位正是這個意思，而 sync-from-vault
      // 曾原樣搬過來（2026-09-18 修）。這條讓它在 build 期擋下，不必靠 publish-scheduled
      // 翻牌時的清理來事後補救：那個清理只在 updated 早於發布日時才會動手。
      .refine((post) => post.draft !== true || post.updated === undefined, {
        message: '未發布的文章不可有 updated（該欄位只用於已上線文章的內容更新）',
        path: ['updated'],
      })
      // 下面三條把 changelog 綁死在既有欄位上。沒有它們，這個欄位會是純裝飾：
      // 頁首印「更新於 X」而紀錄最新一筆是 Y，兩個日期互相打臉，而且沒有任何一支
      // 驗證腳本看得出來——updated 與 changelog 是各自獨立通過 schema 的。
      .refine(
        (post) =>
          post.changelog === undefined ||
          post.changelog.length === 0 ||
          (post.updated !== undefined &&
            post.updated.getTime() === post.changelog[0].date.getTime()),
        {
          message: 'updated 必須等於 changelog 第一筆的日期（最新一筆排最前面）',
          path: ['updated'],
        },
      )
      .refine(
        (post) =>
          post.changelog === undefined ||
          post.changelog.every(
            (entry, i) => i === 0 || entry.date.getTime() <= post.changelog![i - 1].date.getTime(),
          ),
        {
          message: 'changelog 必須由新到舊排序',
          path: ['changelog'],
        },
      )
      .refine(
        (post) =>
          post.changelog === undefined ||
          post.changelog.every((entry) => entry.date.getTime() >= post.date.getTime()),
        {
          message: 'changelog 的日期不可早於發布日',
          path: ['changelog'],
        },
      ),
});

export const collections = { posts };
