"""État joueur + ledger XP + ligues hebdomadaires + trophées.

Le compteur `xp_total` est dénormalisé ; la table XpEvent reste la source
d'audit (somme == compteur, testé).

Ligues (design backend §3.4/§5, gameplay §4) : LeagueWeek (lun 00:00 Beyrouth),
cohortes LeagueGroup ≤ GAME['LEAGUE_GROUP_SIZE'] par tier, adhésion PARESSEUSE
au premier XP de la semaine. `xp_week` = XP réel ; `xp_week_counted` = colonne
du classement, plafonnée à GAME['LEAGUE_DAILY_XP_CAP'] par jour Beyrouth
(l'excédent reste acquis au joueur mais est exclu du tableau).

Trophées (gameplay §5) : définitions pilotées par la table Achievement
(rule_type + threshold + params) évaluées par services/achievements.py.
"""
from django.conf import settings
from django.db import models
from django.utils import timezone


def default_hearts() -> int:
    return settings.GAME["HEARTS_MAX"]


class PlayerState(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="player_state"
    )
    xp_total = models.PositiveIntegerField(default=0)
    hearts = models.PositiveSmallIntegerField(default=default_hearts)
    hearts_updated_at = models.DateTimeField(default=timezone.now)
    streak_current = models.PositiveSmallIntegerField(default=0)
    streak_longest = models.PositiveSmallIntegerField(default=0)
    streak_last_day = models.DateField(null=True, blank=True)
    streak_freezes = models.PositiveSmallIntegerField(default=0)
    review_hearts_earned_today = models.PositiveSmallIntegerField(default=0)
    review_hearts_day = models.DateField(null=True, blank=True)
    # Compteur bon marché pour le trophée « Mémoire d'éléphant » : incrémenté
    # par progress à chaque question diplômée de la révision (boîte 3 réussie).
    review_graduated_total = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "État joueur"
        verbose_name_plural = "États joueur"

    def __str__(self):
        return f"PlayerState<{self.user.username}: {self.xp_total} XP, {self.hearts}♥>"


class XpEvent(models.Model):
    """Ledger append-only. Créé UNIQUEMENT via economy.award_xp (qui bump le compteur)."""

    class EventType(models.TextChoices):
        LEVEL_COMPLETE = "level_complete", "Niveau terminé"
        PERFECT_BONUS = "perfect_bonus", "Bonus sans-faute"
        FIRST_CLEAR_BONUS = "first_clear_bonus", "Bonus première complétion"
        COMBO_BONUS = "combo_bonus", "Bonus combo"
        PRACTICE = "practice", "Révision"
        CHALLENGE_WIN = "challenge_win", "Défi gagné"
        ACHIEVEMENT = "achievement", "Trophée"
        LEGENDARY = "legendary", "Niveau légendaire"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="xp_events"
    )
    amount = models.PositiveSmallIntegerField()
    event_type = models.CharField(max_length=20, choices=EventType.choices)
    attempt = models.ForeignKey(
        "progress.LevelAttempt",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="xp_events",
    )
    meta = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "created_at"], name="xpevent_user_created_idx"),
        ]
        verbose_name = "Événement XP"
        verbose_name_plural = "Événements XP"

    def __str__(self):
        return f"XpEvent<{self.user_id} +{self.amount} {self.event_type}>"


# --- Ligues hebdomadaires -------------------------------------------------------


class LeagueTier(models.Model):
    """Paliers seedés (Bronze → Argent → Or → Diamant → Cèdre), pilotés par data."""

    name = models.CharField(max_length=40)
    order = models.PositiveSmallIntegerField(unique=True)
    icon = models.CharField(max_length=40, help_text="Nom d'icône Lucide (ex. medal)")
    color_hex = models.CharField(max_length=7)

    class Meta:
        ordering = ["order"]
        verbose_name = "Palier de ligue"
        verbose_name_plural = "Paliers de ligue"

    def __str__(self):
        return f"Ligue {self.name}"


class LeagueWeek(models.Model):
    """Semaine ISO (lun 00:00 → lun suivant 00:00, Asia/Beirut). Créée
    paresseusement par leagues.current_week() — l'auto-guérison du système."""

    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    iso_year = models.PositiveSmallIntegerField()
    iso_week = models.PositiveSmallIntegerField()
    is_closed = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["iso_year", "iso_week"], name="leagueweek_iso_unique"),
        ]
        ordering = ["-starts_at"]
        verbose_name = "Semaine de ligue"
        verbose_name_plural = "Semaines de ligue"

    def __str__(self):
        return f"Semaine {self.iso_year}-W{self.iso_week:02d}{' (clôturée)' if self.is_closed else ''}"


class LeagueGroup(models.Model):
    """Cohorte (~GAME['LEAGUE_GROUP_SIZE'] joueurs d'un même palier, une semaine)."""

    week = models.ForeignKey(LeagueWeek, on_delete=models.CASCADE, related_name="groups")
    tier = models.ForeignKey(LeagueTier, on_delete=models.PROTECT, related_name="groups")
    member_count = models.PositiveSmallIntegerField(default=0)

    class Meta:
        verbose_name = "Cohorte de ligue"
        verbose_name_plural = "Cohortes de ligue"

    def __str__(self):
        return f"{self.week} · {self.tier.name} · G{self.pk} ({self.member_count})"


class LeagueMembership(models.Model):
    """Adhésion d'un joueur à une cohorte.

    `xp_week` = XP réel gagné cette semaine (audit, jamais plafonné).
    `xp_week_counted` = XP compté pour le CLASSEMENT (colonne du ORDER BY) :
    chaque jour Beyrouth n'y contribue qu'à hauteur de GAME['LEAGUE_DAILY_XP_CAP'] ;
    `counted_day`/`counted_today` portent le compteur journalier (remis à zéro au
    changement de jour, sous le verrou de la transaction d'award_xp).
    """

    class Outcome(models.TextChoices):
        PROMOTED = "promoted", "Promu·e"
        STAYED = "stayed", "Maintenu·e"
        DEMOTED = "demoted", "Rétrogradé·e"

    group = models.ForeignKey(LeagueGroup, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="league_memberships"
    )
    xp_week = models.PositiveIntegerField(default=0)
    xp_week_counted = models.PositiveIntegerField(default=0)
    counted_day = models.DateField(null=True, blank=True)
    counted_today = models.PositiveIntegerField(default=0)
    joined_at = models.DateTimeField(default=timezone.now)
    final_rank = models.PositiveSmallIntegerField(null=True, blank=True)
    outcome = models.CharField(max_length=10, choices=Outcome.choices, null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "group"], name="leaguemembership_user_group_unique"),
        ]
        indexes = [
            # L'index du classement : ORDER BY xp_week_counted DESC dans une cohorte.
            models.Index(fields=["group", "-xp_week_counted"], name="league_group_counted_idx"),
        ]
        verbose_name = "Adhésion de ligue"
        verbose_name_plural = "Adhésions de ligue"

    def __str__(self):
        return f"LeagueMembership<{self.user_id}·G{self.group_id} {self.xp_week_counted} XP>"


# --- Trophées --------------------------------------------------------------------


class Achievement(models.Model):
    """Définition de trophée pilotée par table (gameplay §5 — les 21).

    Sémantique des rule_type : voir services/achievements.py (docstring).
    `params` porte les extras (fenêtres horaires, mode d'évaluation par matière…).
    """

    class RuleType(models.TextChoices):
        XP_TOTAL = "xp_total", "XP total"
        STREAK_DAYS = "streak_days", "Jours de série"
        LEVELS_COMPLETED = "levels_completed", "Niveaux terminés"
        PERFECT_LEVELS = "perfect_levels", "Niveaux sans-faute"
        SUBJECT_LEVELS_COMPLETED = "subject_levels_completed", "Niveaux par matière"
        FRIENDS_COUNT = "friends_count", "Nombre d'amis"
        CHALLENGES_WON = "challenges_won", "Défis gagnés"
        LEGENDARY_COUNT = "legendary_count", "Couronnes légendaires"
        REVIEW_GRADUATED = "review_graduated", "Questions diplômées en révision"
        LEAGUE_PROMOTED = "league_promoted", "Promotion de ligue"
        LEAGUE_PODIUM = "league_podium", "Podium de ligue"
        LEAGUE_CEDRE_FIRST = "league_cedre_first", "Premier en Ligue Cèdre"
        DAILY_LEVELS = "daily_levels", "Niveaux dans la journée"
        TIME_WINDOW_LEVEL = "time_window_level", "Niveau dans une fenêtre horaire"
        PERFECT_WEEK = "perfect_week", "Semaine parfaite"

    code = models.SlugField(unique=True)
    title = models.CharField(max_length=80)
    description = models.TextField()
    icon = models.CharField(max_length=40, help_text="Nom d'icône Lucide")
    order = models.PositiveSmallIntegerField(default=0)
    rule_type = models.CharField(max_length=30, choices=RuleType.choices)
    threshold = models.PositiveIntegerField(default=1)
    subject = models.ForeignKey(
        "content.Subject", null=True, blank=True, on_delete=models.CASCADE, related_name="achievements"
    )
    is_premium_only = models.BooleanField(default=False)
    params = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["order", "id"]
        verbose_name = "Trophée"
        verbose_name_plural = "Trophées"

    def __str__(self):
        return self.title


class UserAchievement(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="achievements"
    )
    achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE, related_name="unlocks")
    unlocked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "achievement"], name="userachievement_user_achievement_unique"
            ),
        ]
        verbose_name = "Trophée débloqué"
        verbose_name_plural = "Trophées débloqués"

    def __str__(self):
        return f"UserAchievement<{self.user_id}·{self.achievement_id}>"
