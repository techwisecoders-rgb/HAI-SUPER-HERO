-- Business dashboard media bucket. The API uploads through the service-role client.
insert into storage.buckets (id, name, public)
values ('business-media', 'business-media', true)
on conflict (id) do update set public = excluded.public;
