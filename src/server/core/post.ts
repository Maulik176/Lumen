import { reddit } from '@devvit/web/server';
import { toPostData } from '../../shared/api';
import { weekdayLabel } from '../../shared/calendar';
import { COPY } from '../../shared/config';
import { islandForDay } from './content';

/** Create the post for a day's island. Milestone 5 makes this idempotent and adds the sticky. */
export async function createDailyPost(day: number) {
  const island = islandForDay(day);
  if (island === undefined) throw new Error(`No island for day ${day}.`);
  const title = COPY.postTitle
    .replace('{day}', String(island.day))
    .replace('{name}', island.name)
    .replace('{weekday}', weekdayLabel(island.weekday));
  return await reddit.submitCustomPost({
    title,
    entry: 'default',
    postData: toPostData(island),
  });
}
