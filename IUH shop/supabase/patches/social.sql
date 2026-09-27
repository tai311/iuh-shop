-- Social permissions and atomic direct conversations. Apply in the root migration.
create or replace function public.get_or_create_direct_conversation(p_other_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_id uuid; v_admin boolean;
begin
  if v_me is null or p_other_user_id is null or p_other_user_id = v_me then
    raise exception 'Cuộc trò chuyện không hợp lệ.';
  end if;
  if not exists(select 1 from public.users where user_id = p_other_user_id) then
    raise exception 'Không tìm thấy người nhận.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(least(v_me::text,p_other_user_id::text)||':'||greatest(v_me::text,p_other_user_id::text), 0));
  select c.id, c.is_admin_chat into v_id,v_admin
  from public.conversations c
  where exists(select 1 from public.conversation_members m where m.conversation_id=c.id and m.user_id=v_me)
    and exists(select 1 from public.conversation_members m where m.conversation_id=c.id and m.user_id=p_other_user_id)
    and (select count(*) from public.conversation_members m where m.conversation_id=c.id)=2
  order by c.created_at,c.id limit 1;
  if v_id is null then
    v_id := gen_random_uuid();
    select exists(select 1 from public.users where user_id in(v_me,p_other_user_id) and role='admin') into v_admin;
    insert into public.conversations(id,is_admin_chat) values(v_id,v_admin);
    insert into public.conversation_members(conversation_id,user_id) values(v_id,v_me),(v_id,p_other_user_id);
  end if;
  return jsonb_build_object('id',v_id,'is_admin_chat',v_admin);
end $$;
revoke all on function public.get_or_create_direct_conversation(uuid) from public, anon;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;

-- Memberships can only be created by the checked RPC; a user cannot join arbitrary chats.
revoke insert,update,delete on public.conversation_members from anon,authenticated;
revoke insert,delete on public.conversations from anon,authenticated;
drop policy if exists "Users can insert conversation members" on public.conversation_members;
drop policy if exists chat_members_insert on public.conversation_members;
drop policy if exists chat_members_update on public.conversation_members;
drop policy if exists chat_conversations_insert on public.conversations;

create or replace function private.guard_conversation_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon','authenticated') and
    (new.id is distinct from old.id or new.created_at is distinct from old.created_at
      or new.is_admin_chat is distinct from old.is_admin_chat) then
    raise exception 'Không được thay đổi thông tin định danh cuộc trò chuyện.';
  end if;
  return new;
end $$;
drop trigger if exists guard_conversation_update on public.conversations;
create trigger guard_conversation_update before update on public.conversations
for each row execute function private.guard_conversation_update();

drop policy if exists chat_reactions_update on public.message_reactions;
create policy chat_reactions_update on public.message_reactions for update to authenticated
using(user_id=auth.uid()) with check(user_id=auth.uid() and exists(
 select 1 from public.messages m where m.id=message_id and public.is_chat_member(m.conversation_id,auth.uid())
));

create or replace function private.guard_message_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and current_user in ('anon','authenticated') then
    if old.sender_id <> auth.uid() then raise exception 'Chỉ người gửi được sửa hoặc thu hồi tin nhắn.'; end if;
    if new.id is distinct from old.id or new.sender_id is distinct from old.sender_id
      or new.conversation_id is distinct from old.conversation_id
      or new.created_at is distinct from old.created_at or new.product_id is distinct from old.product_id
      or new.is_read is distinct from old.is_read then
      raise exception 'Không được thay đổi thông tin định danh của tin nhắn.';
    end if;
    if old.recalled_at is not null then raise exception 'Tin nhắn đã được thu hồi.'; end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_message_update on public.messages;
create trigger guard_message_update before update on public.messages for each row execute function private.guard_message_update();
drop policy if exists "Users can mark messages as read" on public.messages;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if auth.uid() is null or not public.is_chat_member(p_conversation_id,auth.uid()) then
    raise exception 'Bạn không thuộc cuộc trò chuyện này.';
  end if;
  update public.messages set is_read=true
  where conversation_id=p_conversation_id and sender_id<>auth.uid() and is_read=false;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke all on function public.mark_conversation_read(uuid) from public,anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

create or replace function private.can_publish_articles()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.users where user_id=auth.uid() and role in ('admin','moderator'));
$$;
revoke all on function private.can_publish_articles() from public;
grant usage on schema private to authenticated;
grant execute on function private.can_publish_articles() to authenticated;
drop policy if exists "Users can create own forum articles" on public.forum_articles;
drop policy if exists "Users can update own forum articles" on public.forum_articles;
drop policy if exists "Users can delete own forum articles" on public.forum_articles;
create policy "Staff create official articles" on public.forum_articles for insert to authenticated
  with check (author_id=auth.uid() and private.can_publish_articles());
create policy "Staff edit own official articles" on public.forum_articles for update to authenticated
  using(author_id=auth.uid() and private.can_publish_articles())
  with check(author_id=auth.uid() and private.can_publish_articles());
create policy "Staff delete own official articles" on public.forum_articles for delete to authenticated
  using(author_id=auth.uid() and private.can_publish_articles());

drop policy if exists forum_posts_select on public.forum_posts;
create policy forum_posts_select on public.forum_posts for select to anon,authenticated
  using(moderation_status='active');
create policy "Members view own moderated posts" on public.forum_posts for select to authenticated
  using(author_id=auth.uid() or private.is_admin());
create policy "Admin moderate forum posts" on public.forum_posts for update to authenticated
  using(private.is_admin()) with check(private.is_admin());
create or replace function private.guard_forum_post_moderation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not private.is_admin() then
    if tg_op='INSERT' and coalesce(new.moderation_status,'active')<>'active' then
      raise exception 'Trạng thái bài viết không hợp lệ.';
    elsif tg_op='UPDATE' and new.moderation_status is distinct from old.moderation_status then
      raise exception 'Chỉ quản trị viên được thay đổi trạng thái kiểm duyệt.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_forum_post_moderation on public.forum_posts;
create trigger guard_forum_post_moderation before insert or update on public.forum_posts
for each row execute function private.guard_forum_post_moderation();

-- Avoid exposing private student cards. Root installs owner/admin policies.
update storage.buckets set public=false where id in ('student-cards','chat-images');
update storage.buckets set file_size_limit=10485760,
allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif']
where id in ('avatars','forum-images','chat-images');
drop policy if exists "Users can delete avatars" on storage.objects;
drop policy if exists "Users can update avatars" on storage.objects;
drop policy if exists "Users can upload avatars" on storage.objects;
drop policy if exists forum_images_insert on storage.objects;
drop policy if exists forum_images_update on storage.objects;
drop policy if exists forum_images_delete on storage.objects;
create policy "Own public images insert" on storage.objects for insert to authenticated
with check(bucket_id in ('avatars','forum-images') and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Own public images update" on storage.objects for update to authenticated
using(bucket_id in ('avatars','forum-images') and owner_id=auth.uid()::text)
with check(bucket_id in ('avatars','forum-images') and owner_id=auth.uid()::text and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Own public images delete" on storage.objects for delete to authenticated
using(bucket_id in ('avatars','forum-images') and (owner_id=auth.uid()::text or private.is_admin()));

grant execute on function public.is_chat_member(uuid,uuid) to authenticated;
create or replace function private.can_access_chat_image(p_path text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_conversation uuid;
begin
  if auth.uid() is null then return false; end if;
  begin v_conversation := split_part(p_path,'/',2)::uuid;
  exception when invalid_text_representation then
    return exists(select 1 from public.messages m where
      (m.image_url=p_path or m.image_url='https://xecxofmogvqysejjpxvl.supabase.co/storage/v1/object/public/chat-images/'||p_path)
      and public.is_chat_member(m.conversation_id,auth.uid()));
  end;
  return public.is_chat_member(v_conversation,auth.uid());
end $$;
revoke all on function private.can_access_chat_image(text) from public;
grant execute on function private.can_access_chat_image(text) to authenticated;
create policy "Chat members upload images" on storage.objects for insert to authenticated
with check(bucket_id='chat-images' and (storage.foldername(name))[1]=auth.uid()::text and private.can_access_chat_image(name));
create policy "Chat members read images" on storage.objects for select to authenticated
using(bucket_id='chat-images' and private.can_access_chat_image(name));
create policy "Chat image owner delete" on storage.objects for delete to authenticated
using(bucket_id='chat-images' and owner_id=auth.uid()::text);

-- Account metadata never sets authorization or verified flags.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users(user_id,fullname,student_id,faculty,email,phone,is_graduated,created_at)
  values(new.id,new.raw_user_meta_data->>'fullname',new.raw_user_meta_data->>'student_id',
    new.raw_user_meta_data->>'faculty',new.email,new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->'is_graduated'='true'::jsonb,false),now());
  return new;
end $$;
revoke all on function public.handle_new_user() from public,anon,authenticated;

create or replace function public.admin_set_student_verified(target_user_id uuid, verified boolean)
returns json language plpgsql security definer set search_path = '' as $$
declare v_user public.users%rowtype; v_path text; v_bucket text := 'student-cards'; v_match text[];
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Bạn không có quyền xác thực tài khoản.' using errcode='42501';
  end if;
  if verified is null then raise exception 'Trạng thái xác thực không hợp lệ.'; end if;
  select * into v_user from public.users where user_id=target_user_id for update;
  if not found then raise exception 'Không tìm thấy tài khoản.'; end if;
  if verified then
    v_path := v_user.student_card_url;
    if v_path ~ '^https?://' then
      v_match := regexp_match(v_path,
        '^https://xecxofmogvqysejjpxvl\.supabase\.co/storage/v1/object/(public|sign|authenticated)/(student-cards|student-verifications)/([^?#]+)');
      if v_match is null then raise exception 'Đường dẫn thẻ sinh viên không hợp lệ.'; end if;
      v_bucket := v_match[2];
      v_path := v_match[3];
    end if;
    if v_path is null or split_part(v_path,'/',1)<>target_user_id::text
      or v_path like '%..%' or v_path like '%\%%' escape '\' then
      raise exception 'Ảnh thẻ phải thuộc tài khoản được xác thực.';
    end if;
    if not exists(select 1 from storage.objects where bucket_id=v_bucket and name=v_path
      and owner_id=target_user_id::text) then
      raise exception 'Chưa có ảnh thẻ hợp lệ. Vui lòng yêu cầu người dùng tải lại ảnh thẻ.';
    end if;
  end if;
  update public.users set student_verified=verified,
    verification_status=case when verified then 'approved' else 'none' end,
    verification_method=case when verified then 'admin_grant' else 'none' end,
    verified_by=case when verified then auth.uid() else null end,
    verified_at=case when verified then now() else null end
  where user_id=target_user_id;
  return json_build_object('success',true,'verified',verified,'target_user_id',target_user_id);
end $$;
revoke all on function public.admin_set_student_verified(uuid,boolean) from public,anon;
grant execute on function public.admin_set_student_verified(uuid,boolean) to authenticated;
