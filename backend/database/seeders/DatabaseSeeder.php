<?php

namespace Database\Seeders;

// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(RoleSeeder::class);
        $this->call(ReferenceDataSeeder::class);
        $this->call(DemoFeedSeeder::class);
        $this->call(DemoListingsSeeder::class);
        $this->call(DemoChatSeeder::class);
        $this->call(DemoMediaSeeder::class);
        $this->call(ChannelSeeder::class);
        $this->call(FaqSeeder::class);
    }
}
