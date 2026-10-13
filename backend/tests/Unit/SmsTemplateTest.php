<?php

namespace Tests\Unit;

use App\Services\Sms\SmsTemplate;
use PHPUnit\Framework\TestCase;

class SmsTemplateTest extends TestCase
{
    public function test_verification_template_matches_mts_approval(): void
    {
        $this->assertSame(
            '152047 - ваш код для доступа к сервису Modelizm. Не сообщайте его никому.',
            SmsTemplate::Verification->render(['152047'])
        );
    }

    public function test_phone_change_template_matches_mts_approval(): void
    {
        $this->assertSame(
            '152047 - ваш код для смены номера в Modelizm. Не сообщайте его никому.',
            SmsTemplate::PhoneChange->render(['152047'])
        );
    }

    public function test_ad_published_template_with_title(): void
    {
        $this->assertSame(
            'Modelizm: объявление «Продам модель танка Т-34» опубликовано. modelizmclub.ru',
            SmsTemplate::AdPublished->render(['Продам модель танка Т-34'])
        );
    }

    public function test_static_templates_have_no_placeholders(): void
    {
        $this->assertSame(
            'Modelizm: добро пожаловать! Заполните профиль: modelizmclub.ru',
            SmsTemplate::Welcome->render()
        );
    }
}
