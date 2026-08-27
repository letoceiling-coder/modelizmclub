<?php

namespace Database\Seeders;

// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     *
     * Production deploys must not call this class: several seeders used to
     * overwrite admin-edited settings, tariffs and listing prices. Deploy
     * only runs RoleSeeder. Local/dev first-time setup is still this file.
     */
    public function run(): void
    {
        $this->call(RoleSeeder::class);
        $this->call(ReferenceDataSeeder::class);
        $this->call(SubscriptionPlansSeeder::class);
        $this->call(BoostPackagesSeeder::class);
        $this->call(VideoCategoriesSeeder::class);
        $this->call(FeatureFlagsSeeder::class);
        $this->call(DemoFeedSeeder::class);
        $this->call(DemoListingsSeeder::class);
        $this->call(DemoChatSeeder::class);
        $this->call(DemoMediaSeeder::class);
        $this->call(ChannelSeeder::class);
        $this->call(LegalComplianceSeeder::class);
        $this->call(RulesHubSeeder::class);
        $this->call(DeliveryMethodsSeeder::class);
        $this->call(FaqSeeder::class);
        $this->call(LandingPageSeeder::class);
    }
}
