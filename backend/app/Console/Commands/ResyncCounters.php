<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Приводит счётчики-кеши к тому, что действительно лежит в связях.
 *
 * Сами колонки честные: код их инкрементирует при подписке, лайке, добавлении
 * в избранное. Соврали сиды. `ChannelSeeder` записывал в `subscribers_count`
 * 12480, 8920, 5230 и так далее, `DemoListingsSeeder` — `views_count` лесенкой
 * `100 + $i * 50` и `favorites_count` как `$i % 3`.
 *
 * Замер прода 07.09: у каналов в сумме 39 103 подписчика при пяти настоящих
 * подписках, причём ModelShop24 показывал 5 230 и Scale Weekly 2 140 при нуле.
 * У объявлений — сотни просмотров при двух-пяти настоящих.
 *
 * Команда идемпотентна: повторный запуск ничего не меняет, если расхождений
 * нет. `--dry-run` только показывает расхождения.
 */
class ResyncCounters extends Command
{
    protected $signature = 'counters:resync {--dry-run : только показать расхождения}';

    protected $description = 'Пересчитать счётчики-кеши из настоящих связей';

    /** @var list<array{string, string, string}> [подпись, SQL пересчёта, SQL подсчёта расхождений] */
    private function targets(): array
    {
        return [
            [
                'channels.subscribers_count',
                'update channels c set subscribers_count = x.n from (select ch.id, (select count(*) from channel_subscriptions s where s.channel_id = ch.id) as n from channels ch) x where x.id = c.id and c.subscribers_count is distinct from x.n',
                'select count(*) from channels c where c.subscribers_count is distinct from (select count(*) from channel_subscriptions s where s.channel_id = c.id)',
            ],
            [
                'listings.favorites_count',
                'update listings l set favorites_count = x.n from (select li.id, (select count(*) from listing_favorites f where f.listing_id = li.id) as n from listings li) x where x.id = l.id and l.favorites_count is distinct from x.n',
                'select count(*) from listings l where l.favorites_count is distinct from (select count(*) from listing_favorites f where f.listing_id = l.id)',
            ],
            [
                'listings.views_count',
                'update listings l set views_count = x.n from (select li.id, (select coalesce(sum(v.views_count), 0) from listing_view_daily v where v.listing_id = li.id) as n from listings li) x where x.id = l.id and l.views_count is distinct from x.n',
                'select count(*) from listings l where l.views_count is distinct from (select coalesce(sum(v.views_count), 0) from listing_view_daily v where v.listing_id = l.id)',
            ],
            [
                'posts.reactions_count',
                'update posts p set reactions_count = x.n from (select po.id, (select count(*) from post_reactions r where r.post_id = po.id) as n from posts po) x where x.id = p.id and p.reactions_count is distinct from x.n',
                'select count(*) from posts p where p.reactions_count is distinct from (select count(*) from post_reactions r where r.post_id = p.id)',
            ],
            [
                'posts.comments_count',
                "update posts p set comments_count = x.n from (select po.id, (select count(*) from comments c where c.commentable_type = 'App\\\\Models\\\\Post' and c.commentable_id = po.id and c.deleted_at is null) as n from posts po) x where x.id = p.id and p.comments_count is distinct from x.n",
                "select count(*) from posts p where p.comments_count is distinct from (select count(*) from comments c where c.commentable_type = 'App\\\\Models\\\\Post' and c.commentable_id = p.id and c.deleted_at is null)",
            ],
            [
                'channel_posts.likes_count',
                'update channel_posts p set likes_count = x.n from (select cp.id, (select count(*) from channel_post_likes l where l.channel_post_id = cp.id) as n from channel_posts cp) x where x.id = p.id and p.likes_count is distinct from x.n',
                'select count(*) from channel_posts p where p.likes_count is distinct from (select count(*) from channel_post_likes l where l.channel_post_id = p.id)',
            ],
            [
                'communities.members_count',
                'update communities c set members_count = x.n from (select co.id, (select count(*) from community_members m where m.community_id = co.id) as n from communities co) x where x.id = c.id and c.members_count is distinct from x.n',
                'select count(*) from communities c where c.members_count is distinct from (select count(*) from community_members m where m.community_id = c.id)',
            ],
        ];
    }

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');
        $touched = 0;

        foreach ($this->targets() as [$label, $update, $count]) {
            $drifted = (int) DB::selectOne("select ({$count}) as n")->n;

            if ($drifted === 0) {
                $this->line(sprintf('  %-30s совпадает', $label));

                continue;
            }

            if ($dry) {
                $this->warn(sprintf('  %-30s расходится строк: %d', $label, $drifted));

                continue;
            }

            $changed = DB::update($update);
            $touched += $changed;
            $this->info(sprintf('  %-30s пересчитано строк: %d', $label, $changed));
        }

        $this->newLine();
        $this->line($dry ? 'Только показ, ничего не менялось.' : "Всего изменено строк: {$touched}");

        return self::SUCCESS;
    }
}
