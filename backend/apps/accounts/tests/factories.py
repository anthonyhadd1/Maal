import factory
from django.contrib.auth.hashers import make_password

from apps.accounts.models import Profile, User

DEFAULT_PASSWORD = "test-Passw0rd!"


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    username = factory.Sequence(lambda n: f"user{n:04d}")
    password = factory.LazyFunction(lambda: make_password(DEFAULT_PASSWORD))
    email = factory.LazyAttribute(lambda o: f"{o.username}@example.com")

    @factory.post_generation
    def with_satellites(obj, create, extracted, **kwargs):
        if not create or extracted is False:
            return
        Profile.objects.get_or_create(user=obj, defaults={"display_name": obj.username})
        try:
            from apps.gamification.models import PlayerState

            PlayerState.objects.get_or_create(user=obj)
        except ImportError:
            pass
        try:
            from apps.billing.models import Entitlement

            Entitlement.objects.get_or_create(user=obj)
        except ImportError:
            pass
