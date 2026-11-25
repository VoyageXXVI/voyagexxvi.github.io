begin;
alter table voyage_private.settings add column uploads boolean not null default false;
create function voyage_private.validate_record() returns trigger language plpgsql security definer set search_path='' as $$declare changed boolean;img jsonb; bytes bytea; n int; chunk int;begin
changed:=case when tg_op='INSERT' then new.data ? 'photos' else (new.data->'photos') is distinct from (old.data->'photos') end;
if changed and new.data ? 'photos' then
if jsonb_typeof(new.data->'photos')<>'array' or jsonb_array_length(new.data->'photos')>3 then raise exception 'Three private photos per record';end if;
if jsonb_array_length(new.data->'photos')>0 then
if not(select uploads from voyage_private.settings) or new.data->>'photoRights' is distinct from 'accepted' or new.kind not in ('visit','journal') then raise exception 'Photo uploads are closed or permission is missing';end if;
for img in select value from jsonb_array_elements(new.data->'photos') loop
if jsonb_typeof(img)<>'string' or length(img#>>'{}')>12500 or (img#>>'{}') !~ '^data:image/webp;base64,UklGR[A-Za-z0-9+/]+={0,2}$' then raise exception 'Invalid image';end if;
bytes:=decode(substr(img#>>'{}',24),'base64');n:=length(bytes);
if n<30 or substring(bytes from 1 for 4)<>decode('52494646','hex') or substring(bytes from 9 for 8)<>decode('5745425056503820','hex') or substring(bytes from 24 for 3)<>decode('9d012a','hex') then raise exception 'A re-encoded single-frame WebP is required';end if;
chunk:=get_byte(bytes,16)+get_byte(bytes,17)*256+get_byte(bytes,18)*65536;
if get_byte(bytes,7)<>0 or get_byte(bytes,19)<>0 or n<>8+get_byte(bytes,4)+get_byte(bytes,5)*256+get_byte(bytes,6)*65536 or n<>20+chunk+(chunk%2) or (get_byte(bytes,26)+(get_byte(bytes,27)%64)*256) not between 1 and 500 or (get_byte(bytes,28)+(get_byte(bytes,29)%64)*256) not between 1 and 500 then raise exception 'Unsupported image dimensions or metadata';end if;
end loop;
end if;end if;
perform pg_advisory_xact_lock(hashtextextended(new.owner::text,0));
if (select coalesce(sum(octet_length(data::text)),0) from public.v26_records where owner=new.owner and id<>new.id)+octet_length(new.data::text)>4000000 then raise exception 'Private record storage quota reached';end if;return new;end$$;
create trigger v26_validate before insert or update on public.v26_records for each row execute function voyage_private.validate_record();
create function public.v26_ops() returns jsonb language plpgsql stable security definer set search_path='' as $$begin if not exists(select 1 from voyage_private.staff join public.v26_profiles using(id) where id=auth.uid() and not suspended) then raise exception 'Administrator required';end if;return jsonb_build_object('newAccounts30Days',(select count(*) from public.v26_profiles where created_at>now()-interval '30 days'),'publishedStories',(select count(*) from public.v26_posts where kind='story' and status='published'),'reviews',(select count(*) from public.v26_posts where kind='review'),'privateRecordBytes',(select coalesce(sum(octet_length(data::text)),0) from public.v26_records),'uploads',(select uploads from voyage_private.settings));end$$;
create function public.v26_pause_uploads() returns void language plpgsql security definer set search_path='' as $$begin perform public.v26_ops();update voyage_private.settings set uploads=false;insert into voyage_private.audit(actor,action,subject) values(auth.uid(),'pause','uploads');end$$;
create function public.v26_export() returns jsonb language plpgsql stable security definer set search_path='' as $$begin if auth.uid() is null then raise exception 'Sign in required';end if;return jsonb_build_object('profile',(select to_jsonb(p) from public.v26_profiles p where id=auth.uid()),'records',(select coalesce(jsonb_agg(r),'[]') from public.v26_records r where owner=auth.uid()),'agreements',(select coalesce(jsonb_agg(a),'[]') from public.v26_acceptance a where id=auth.uid()),'posts',(select coalesce(jsonb_agg(f),'[]') from public.v26_posts f where owner=auth.uid()),'reports',(select coalesce(jsonb_agg(r),'[]') from public.v26_reports r where owner=auth.uid()),'sharing',(select coalesce(jsonb_agg(i),'[]') from voyage_private.invites i join public.v26_records r on r.id=i.record where r.owner=auth.uid()),'preferences',(select coalesce(jsonb_agg(l),'[]') from voyage_private.links l where actor=auth.uid()),'reactions',(select coalesce(jsonb_agg(x),'[]') from voyage_private.reactions x where actor=auth.uid()));end$$;
revoke all on function public.v26_ops(),public.v26_pause_uploads(),public.v26_export() from public,anon,authenticated;
grant execute on function public.v26_ops(),public.v26_pause_uploads(),public.v26_export() to authenticated;
commit;
