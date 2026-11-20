import { describe, expect, it } from 'vitest';
import { isClubFixtureRequest, VISUAL_CLUBS } from '../../../tests/helpers/visual-stability';
describe('visual fixtures stay scoped and useful',()=>{
 it('intercepts only the public read contract',()=>{
  const origin='https://ajvlcamxemgbxduhiqrl.supabase.co';
  expect(isClubFixtureRequest(origin+'/rest/v1/club_listing?select=id','GET')).toBe(true);
  for(const [url,method] of [[origin+'/rest/v1/club_listing','POST'],[origin+'/rest/v1/profiles','GET'],['https://other.test/rest/v1/club_listing','GET']]) expect(isClubFixtureRequest(url,method)).toBe(false);
 });
 it('preserves nonempty varied card states instead of masking layout',()=>{
  expect(VISUAL_CLUBS).toHaveLength(2);expect(VISUAL_CLUBS.some(c=>c.upcoming_events>0)).toBe(true);expect(VISUAL_CLUBS.some(c=>c.upcoming_events===0)).toBe(true);expect(VISUAL_CLUBS.some(c=>/Thành/.test(c.name))).toBe(true);
 });
});
