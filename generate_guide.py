# -*- coding: utf-8 -*-
"""
SIGEXPC - Guide Utilisateur PDF
Génère un guide complet de la plateforme SIGEXPC avec ReportLab.
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm, cm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                 PageBreak, Image, KeepTogether, ListFlowable, ListItem)
from reportlab.pdfgen import canvas
from reportlab.lib import colors

OUTPUT = os.path.join(os.path.dirname(__file__), 'Guide_Utilisateur_SIGEXPC.pdf')

# ========== COULEURS (thème SIGEXPC) ==========
BLUE = HexColor('#1e3a8a')
LIGHT_BLUE = HexColor('#3b82f6')
YELLOW = HexColor('#f59e0b')
RED = HexColor('#ef4444')
GREEN = HexColor('#10b981')
DARK = HexColor('#0f172a')
GRAY = HexColor('#64748b')
LIGHT_GRAY = HexColor('#f1f5f9')
WHITE = HexColor('#ffffff')

# ========== STYLES ==========
styles = getSampleStyleSheet()

style_title = ParagraphStyle('CustomTitle', parent=styles['Title'], fontSize=28, textColor=BLUE,
                              spaceAfter=10, fontName='Helvetica-Bold', alignment=TA_CENTER, leading=34)
style_subtitle = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=14, textColor=GRAY,
                                 alignment=TA_CENTER, spaceAfter=20, fontName='Helvetica')
style_h1 = ParagraphStyle('H1', parent=styles['Heading1'], fontSize=18, textColor=BLUE,
                          spaceBefore=25, spaceAfter=10, fontName='Helvetica-Bold', borderWidth=0,
                          borderColor=YELLOW, borderPadding=0, leading=22)
style_h2 = ParagraphStyle('H2', parent=styles['Heading2'], fontSize=14, textColor=DARK,
                          spaceBefore=15, spaceAfter=8, fontName='Helvetica-Bold', leading=18)
style_h3 = ParagraphStyle('H3', parent=styles['Heading3'], fontSize=12, textColor=LIGHT_BLUE,
                          spaceBefore=10, spaceAfter=6, fontName='Helvetica-Bold', leading=16)
style_body = ParagraphStyle('Body', parent=styles['Normal'], fontSize=10, textColor=DARK,
                            alignment=TA_JUSTIFY, spaceAfter=6, leading=14, fontName='Helvetica')
style_bullet = ParagraphStyle('Bullet', parent=style_body, leftIndent=20, bulletIndent=10, spaceAfter=4)
style_note = ParagraphStyle('Note', parent=style_body, fontSize=9, textColor=GRAY, fontName='Helvetica-Oblique')
style_table_header = ParagraphStyle('TableHeader', parent=styles['Normal'], fontSize=9, textColor=WHITE,
                                     fontName='Helvetica-Bold', alignment=TA_CENTER)
style_table_cell = ParagraphStyle('TableCell', parent=styles['Normal'], fontSize=9, textColor=DARK,
                                   fontName='Helvetica', alignment=TA_LEFT, leading=12)
style_table_center = ParagraphStyle('TableCenter', parent=style_table_cell, alignment=TA_CENTER)

# ========== PAGE DECORATION (header/footer) ==========
def page_decoration(canvas_obj, doc):
    canvas_obj.saveState()
    # Bandeau de pied de page
    canvas_obj.setFillColor(BLUE)
    canvas_obj.rect(0, 0, A4[0], 25*mm, fill=1, stroke=0)
    # Texte pied de page
    canvas_obj.setFillColor(WHITE)
    canvas_obj.setFont('Helvetica', 8)
    canvas_obj.drawString(20*mm, 10*mm, 'SIGEXPC - Guide Utilisateur')
    canvas_obj.drawRightString(A4[0] - 20*mm, 10*mm, f'Page {doc.page}')
    # Ligne jaune en haut
    canvas_obj.setFillColor(YELLOW)
    canvas_obj.rect(0, A4[1] - 5*mm, A4[0], 5*mm, fill=1, stroke=0)
    canvas_obj.restoreState()

# ========== COVER PAGE ==========
def cover_page(canvas_obj, doc):
    canvas_obj.saveState()
    # Fond dégradé bleu
    canvas_obj.setFillColor(DARK)
    canvas_obj.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    # Bande jaune
    canvas_obj.setFillColor(YELLOW)
    canvas_obj.rect(0, A4[1] - 12*mm, A4[0], 12*mm, fill=1, stroke=0)
    # Bande bleue
    canvas_obj.setFillColor(BLUE)
    canvas_obj.rect(0, A4[1] - 15*mm, A4[0], 3*mm, fill=1, stroke=0)

    # Titre principal
    canvas_obj.setFillColor(WHITE)
    canvas_obj.setFont('Helvetica-Bold', 36)
    canvas_obj.drawCentredString(A4[0]/2, A4[1]/2 + 40*mm, 'SIGEXPC')

    canvas_obj.setFont('Helvetica-Bold', 16)
    canvas_obj.setFillColor(YELLOW)
    canvas_obj.drawCentredString(A4[0]/2, A4[1]/2 + 25*mm, 'Guide Utilisateur')

    canvas_obj.setFont('Helvetica', 12)
    canvas_obj.setFillColor(HexColor('#94a3b8'))
    canvas_obj.drawCentredString(A4[0]/2, A4[1]/2 + 10*mm,
                                  'Système de Gestion des Examens')
    canvas_obj.drawCentredString(A4[0]/2, A4[1]/2 + 2*mm,
                                  'du Permis de Conduire')

    # Côte d'Ivoire
    canvas_obj.setFont('Helvetica-Oblique', 11)
    canvas_obj.setFillColor(HexColor('#cbd5e1'))
    canvas_obj.drawCentredString(A4[0]/2, A4[1]/2 - 15*mm, 'République de Côte d\'Ivoire')

    # Version
    canvas_obj.setFont('Helvetica', 9)
    canvas_obj.setFillColor(HexColor('#64748b'))
    canvas_obj.drawCentredString(A4[0]/2, 35*mm, 'Version 2.0 — Août 2026')
    canvas_obj.drawCentredString(A4[0]/2, 28*mm, 'https://sigexpc.onrender.com')

    # Décoration feux tricolores
    cx = A4[0]/2
    cy = 60*mm
    for i, color in enumerate([RED, YELLOW, GREEN]):
        canvas_obj.setFillColor(color)
        canvas_obj.circle(cx, cy - i*12, 5*mm, fill=1, stroke=0)

    canvas_obj.restoreState()

# ========== CONTENU ==========
def build_story():
    story = []

    # ---- Page de couverture (vide, gérée par cover_page) ----
    story.append(PageBreak())

    # ---- TABLE DES MATIÈRES ----
    story.append(Paragraph('Table des matières', style_h1))
    story.append(Spacer(1, 10))
    toc_data = [
        ['1.', 'Présentation de la plateforme', '3'],
        ['2.', 'Connexion et comptes utilisateurs', '4'],
        ['3.', 'Tableau de bord Super Admin', '6'],
        ['4.', 'Tableau de bord Direction Régionale', '8'],
        ['5.', 'Tableau de bord Auto-École', '12'],
        ['6.', 'Système d\'abonnement et paiement', '16'],
        ['7.', 'Génération de documents', '18'],
        ['8.', 'FAQ et dépannage', '19'],
    ]
    toc_table = Table(toc_data, colWidths=[15*mm, 130*mm, 20*mm])
    toc_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('TEXTCOLOR', (0, 0), (-1, -1), DARK),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica'),
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LINEBELOW', (0, 0), (-1, -1), 0.5, HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(toc_table)
    story.append(PageBreak())

    # ---- 1. PRÉSENTATION ----
    story.append(Paragraph('1. Présentation de la plateforme', style_h1))

    story.append(Paragraph(
        '<b>SIGEXPC</b> (Système de Gestion des Examens du Permis de Conduire) est la plateforme officielle '
        'de gestion des examens théoriques (code) et pratiques (conduite) du permis de conduire en Côte d\'Ivoire. '
        'Elle digitalise l\'ensemble du processus : de l\'inscription des candidats à la délivrance des permis, '
        'en passant par la planification des examens, la délibération et la génération des documents officiels.', style_body))

    story.append(Paragraph('Accès à la plateforme', style_h2))
    story.append(Paragraph('La plateforme est accessible aux adresses suivantes :', style_body))
    access_data = [
        [Paragraph('<b>Page</b>', style_table_header), Paragraph('<b>URL</b>', style_table_header), Paragraph('<b>Utilisateurs</b>', style_table_header)],
        [Paragraph('Connexion générale', style_table_cell), Paragraph('https://sigexpc.onrender.com', style_table_cell), Paragraph('Tous', style_table_center)],
        [Paragraph('Espace Auto-Écoles', style_table_cell), Paragraph('https://sigexpc.onrender.com/autoecole', style_table_cell), Paragraph('Auto-écoles', style_table_center)],
        [Paragraph('Landing page', style_table_cell), Paragraph('https://sigexpc.onrender.com/lp', style_table_cell), Paragraph('Publique', style_table_center)],
    ]
    t = Table(access_data, colWidths=[45*mm, 75*mm, 40*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLUE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_GRAY]),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#cbd5e1')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(t)
    story.append(Spacer(1, 15))

    story.append(Paragraph('Les 5 types d\'utilisateurs', style_h2))
    roles_data = [
        [Paragraph('<b>Rôle</b>', style_table_header), Paragraph('<b>Description</b>', style_table_header)],
        [Paragraph('Super Admin', style_table_cell), Paragraph('Administrateur général : gère les régions, auto-écoles, agents, abonnements et paramètres globaux', style_table_cell)],
        [Paragraph('Direction Régionale', style_table_cell), Paragraph('Planifie les examens, délibère les résultats, gère les bordereaux et bordereaux délibérés', style_table_cell)],
        [Paragraph('Auto-École', style_table_cell), Paragraph('Gère ses candidats, inscrit sur les bordereaux, consulte les résultats et génère des rapports', style_table_cell)],
        [Paragraph('Agent Vérificateur', style_table_cell), Paragraph('Remet les permis de conduire aux candidats aptes', style_table_cell)],
        [Paragraph('Service STTC', style_table_cell), Paragraph('Génère les comptes rendus des examens de conduite', style_table_cell)],
    ]
    t2 = Table(roles_data, colWidths=[40*mm, 120*mm])
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLUE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_GRAY]),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#cbd5e1')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(t2)
    story.append(PageBreak())

    # ---- 2. CONNEXION ----
    story.append(Paragraph('2. Connexion et comptes utilisateurs', style_h1))

    story.append(Paragraph('2.1 Page de connexion générale', style_h2))
    story.append(Paragraph(
        'Accédez à la plateforme via <b>https://sigexpc.onrender.com</b>. La page de connexion présente un logo SIGEXPC, '
        'un sélecteur de rôle, un champ email et un champ code secret. Sélectionnez votre rôle dans la liste déroulante, '
        'saisissez vos identifiants puis cliquez sur « DÉMARRER LA SESSION ».', style_body))

    story.append(Paragraph('2.2 Page de connexion Auto-Écoles', style_h2))
    story.append(Paragraph(
        'Les auto-écoles disposent d\'une page dédiée : <b>https://sigexpc.onrender.com/autoecole</b>. '
        'Cette page est identique au design de la page principale mais réservée aux auto-écoles '
        '(pas de sélecteur de rôle).', style_body))

    story.append(Paragraph('2.3 Comptes par défaut', style_h2))
    accounts_data = [
        [Paragraph('<b>Rôle</b>', style_table_header), Paragraph('<b>Email</b>', style_table_header), Paragraph('<b>Mot de passe</b>', style_table_header)],
        [Paragraph('Super Admin', style_table_cell), Paragraph('admin@test.com', style_table_cell), Paragraph('ADMIN123', style_table_center)],
        [Paragraph('Direction Régionale', style_table_cell), Paragraph('drtat@sysgipc.com', style_table_cell), Paragraph('DIR-HOLFNJ', style_table_center)],
        [Paragraph('AE UNION', style_table_cell), Paragraph('union@sysgipc.com', style_table_cell), Paragraph('PASS-JT71QN', style_table_center)],
        [Paragraph('AE ASSENAH', style_table_cell), Paragraph('assenah@sysgipc.com', style_table_cell), Paragraph('PASS-HI161H', style_table_center)],
        [Paragraph('AE VIGILANCE', style_table_cell), Paragraph('vigilance@sysgipc.com', style_table_cell), Paragraph('PASS-SZYLZP', style_table_center)],
        [Paragraph('Agent Vérificateur', style_table_cell), Paragraph('agent@test.com', style_table_cell), Paragraph('AGENT123', style_table_center)],
        [Paragraph('Service STTC', style_table_cell), Paragraph('sttc@sigexpc.ci', style_table_cell), Paragraph('STTC-OINNR0', style_table_center)],
    ]
    t3 = Table(accounts_data, colWidths=[40*mm, 65*mm, 45*mm])
    t3.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLUE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_GRAY]),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#cbd5e1')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(t3)

    story.append(Spacer(1, 10))
    story.append(Paragraph(
        '<i>Note : Les mots de passe peuvent être modifiés dans la section « Sécurité & Accès » du tableau de bord.</i>', style_note))
    story.append(PageBreak())

    # ---- 3. SUPER ADMIN ----
    story.append(Paragraph('3. Tableau de bord Super Admin', style_h1))

    story.append(Paragraph('Le Super Admin dispose d\'une vue globale sur tout le système. Son menu latéral contient :', style_body))

    story.append(Paragraph('3.1 Tableau de bord', style_h2))
    story.append(Paragraph(
        'Vue d\'ensemble avec statistiques générales : nombre total de candidats, auto-écoles actives, '
        'examens programmés, etc. Un tableau consultatif liste tous les candidats récents avec filtres '
        'par examen et recherche.', style_body))

    story.append(Paragraph('3.2 Directions Régionales', style_h2))
    story.append(Paragraph('Gestion CRUD (Créer, Lire, Modifier, Supprimer) des directions régionales :', style_body))
    items = [
        'Créer une nouvelle direction avec son nom, email admin et code d\'accès',
        'Modifier les informations d\'une direction existante',
        'Supprimer une direction (ses données liées sont aussi supprimées)',
        'Chaque direction affiche son code d\'accès pour communication',
    ]
    for item in items:
        story.append(Paragraph(f'• {item}', style_bullet))

    story.append(Paragraph('3.3 Abonnements', style_h2))
    story.append(Paragraph(
        'Gestion des abonnements des auto-écoles. Le Super Admin peut :', style_body))
    items = [
        '<b>Bloquer</b> une auto-école (suspend l\'accès immédiatement)',
        '<b>Réactiver</b> une auto-école (génère une nouvelle période d\'abonnement + reçu)',
        'Consulter les statistiques : Actifs, Bloqués, Expirent bientôt (<7j)',
        'Filtrer par statut et rechercher par nom/email/région',
        'Exporter la liste complète en Excel',
    ]
    for item in items:
        story.append(Paragraph(f'• {item}', style_bullet))

    story.append(Paragraph('3.4 Reçus de paiement', style_h2))
    story.append(Paragraph(
        'Consultation et suppression des reçus de paiement générés après chaque transaction GeniusPay '
        'ou réactivation manuelle par le Super Admin.', style_body))

    story.append(Paragraph('3.5 Paramètres abonnement', style_h2))
    story.append(Paragraph(
        'Configuration du montant mensuel (en FCFA) et de la durée d\'abonnement (en jours). '
        'Ces valeurs s\'appliquent à toutes les auto-écoles et sont utilisées lors des paiements GeniusPay.', style_body))

    story.append(PageBreak())

    # ---- 4. DIRECTION RÉGIONALE ----
    story.append(Paragraph('4. Tableau de bord Direction Régionale', style_h1))

    story.append(Paragraph('La Direction Régionale orchestre les examens. Son menu contient :', style_body))

    story.append(Paragraph('4.1 Tableau de bord', style_h2))
    story.append(Paragraph(
        'Statistiques régionales : candidats en attente, examens planifiés, candidats aptes/inaptes. '
        'Tableau consultatif des candidats avec filtres.', style_body))

    story.append(Paragraph('4.2 Planification examens', style_h2))
    story.append(Paragraph(
        'C\'est le cœur du système. La Direction peut :', style_body))
    items = [
        '<b>Créer un examen</b> : type (Code/Conduite), date, heure, lieu, inspecteur, places maximum, agents vérificateurs',
        '<b>Ouvrir/Fermer/Réouvrir</b> un examen (3 états) pour contrôler les inscriptions',
        '<b>Accéder à la salle d\'examen</b> : voir tous les candidats inscrits, autoriser la liste principale et les rajouts',
        '<b>Valider la délibération</b> en masse : marquer tous les candidats APTE par défaut, puis ajuster individuellement',
        '<b>Importer des candidats par CSV</b> : fichier Excel avec colonnes Nom, Identifiant, Catégorie',
        '<b>Imprimer le bordereau d\'examen</b> avant délibération',
    ]
    for item in items:
        story.append(Paragraph(f'• {item}', style_bullet))

    story.append(Paragraph('4.3 Bordereaux', style_h2))
    story.append(Paragraph(
        'Liste des examens ouverts/fermés avec génération PDF des bordereaux d\'examen '
        '(avant délibération). Le bordereau contient : en-tête officielle, récapitulatif par auto-école, '
        'tableau des candidats avec émargement, et zone de signature inspecteur + directeur régional.', style_body))

    story.append(Paragraph('4.4 Bordereaux délibérés', style_h2))
    story.append(Paragraph(
        'Liste des examens délibérés (résultats validés) avec génération PDF du bordereau délibéré. '
        'Ce document inclut les résultats de chaque candidat : APTE, INAPTE, ABSENT, NON ÉVALUÉ, '
        'ainsi qu\'un récapitulatif statistique.', style_body))

    story.append(Paragraph('4.5 Comptes rendus STTC', style_h2))
    story.append(Paragraph(
        'Génération des comptes rendus des examens de conduite pour le Service STTC.', style_body))

    story.append(Paragraph('4.6 Bilan & Statistiques', style_h2))
    story.append(Paragraph(
        'Statistiques avancées avec graphiques : nombre d\'aptes (code/conduite), inaptes, absents, non évalués, '
        'taux de réussite par auto-école et par période.', style_body))

    story.append(Paragraph('4.7 Analyse TCD', style_h2))
    story.append(Paragraph(
        'Tableau Croisé Dynamique interactif avec filtres temporels :', style_body))
    items = [
        '9 périodes : Tout l\'historique, Cette année, Ce mois, 4 trimestres, 2 semestres',
        '4 cartes cliquables : Admis (Conduite), Admis (Code), Inaptes, Absents',
        'Graphique en barres colorées',
        'Détail des candidats au clic sur une carte, avec recherche et export CSV',
    ]
    for item in items:
        story.append(Paragraph(f'• {item}', style_bullet))

    story.append(Paragraph('4.8 Auto-Écoles, Agents Vérificateurs, Agents STTC, Signataires', style_h2))
    story.append(Paragraph(
        'Gestion CRUD de toutes les entités régionales : création, modification, suppression. '
        'Chaque entité affiche son code d\'accès. Les signataires (directeur régional, chef STTC, coordonnateur) '
        'sont configurables et apparaissent automatiquement sur les documents officiels.', style_body))

    story.append(PageBreak())

    # ---- 5. AUTO-ÉCOLE ----
    story.append(Paragraph('5. Tableau de bord Auto-École', style_h1))

    story.append(Paragraph('L\'auto-école gère ses candidats et suit ses résultats. Son menu contient :', style_body))

    story.append(Paragraph('5.1 Candidats', style_h2))
    story.append(Paragraph(
        'Gestion des candidats avec formulaire en ligne. Le filtre « Dossiers purs » n\'affiche que les candidats '
        'en attente d\'inscription (non encore inscrits sur un bordereau). Pour chaque candidat :', style_body))
    items = [
        'Nom et prénoms, identifiant (numéro de pièce), catégorie (A, AB, BCDE, ABCDE)',
        'Étape actuelle (Code ou Conduite)',
        'Modification et suppression possibles',
    ]
    for item in items:
        story.append(Paragraph(f'• {item}', style_bullet))

    story.append(Paragraph('5.2 Inscriptions bordereau', style_h2))
    story.append(Paragraph(
        'Inscription des candidats sur les sessions d\'examen ouvertes par la Direction Régionale :', style_body))
    items = [
        'Sélection de la session dans la liste déroulante',
        'Tableau des candidats éligibles avec cases à cocher',
        'Statut affiché pour chaque candidat (Prêt à soumettre, Admis dernier Code, Ajourné, Déjà inscrit)',
        'Bouton « SUPPRIMER » pour retirer des inscriptions en attente',
        'Bouton « SOUMETTRE LE BORDEREAU » pour envoyer la liste à la Direction',
        'Recherche par nom ou identifiant',
    ]
    for item in items:
        story.append(Paragraph(f'• {item}', style_bullet))

    story.append(Paragraph('5.3 Analyse TCD', style_h2))
    story.append(Paragraph(
        'Mêmes fonctionnalités que la Direction Régionale mais limitées aux candidats de l\'auto-école.', style_body))

    story.append(Paragraph('5.4 Rapports officiels', style_h2))
    story.append(Paragraph(
        'Génération de rapports d\'activité périodiques avec aperçu A4 inline :', style_body))
    items = [
        'Sélection de la période (trimestres, semestres, année complète)',
        'Bouton « Générer l\'aperçu » : affiche le document administratif dans la page',
        'Bouton « Télécharger en PDF » : impression via le navigateur',
        'Le rapport contient : en-tête officielle, statistiques réelles, taux de réussite, signature',
    ]
    for item in items:
        story.append(Paragraph(f'• {item}', style_bullet))

    story.append(Paragraph('5.5 Bordereaux délibérés', style_h2))
    story.append(Paragraph(
        'Consultation des bordereaux délibérés (résultats) des examens où l\'auto-école a présenté des candidats. '
        'Uniquement les candidats de cette auto-école sont visibles (confidentialité). '
        'Génération PDF du bordereau délibéré.', style_body))

    story.append(Paragraph('5.6 Mon abonnement', style_h2))
    story.append(Paragraph(
        'Consultation de l\'état de l\'abonnement : statut (Actif/Expiré), jours restants, date d\'expiration. '
        'Historique des paiements (reçus).', style_body))

    story.append(Paragraph('5.7 Sécurité & Accès', style_h2))
    story.append(Paragraph(
        'Changement du code d\'accès par le gérant. Gestion du personnel (secrétaires) avec codes d\'accès individuels.', style_body))

    story.append(PageBreak())

    # ---- 6. ABONNEMENT ----
    story.append(Paragraph('6. Système d\'abonnement et paiement', style_h1))

    story.append(Paragraph('6.1 Fonctionnement', style_h2))
    story.append(Paragraph(
        'Chaque auto-école doit avoir un abonnement actif pour accéder à la plateforme. L\'abonnement est défini '
        'par le Super Admin (montant et durée). Le statut d\'accès ne peut être que :', style_body))

    abo_data = [
        [Paragraph('<b>Statut</b>', style_table_header), Paragraph('<b>Description</b>', style_table_header)],
        [Paragraph('<font color="#10b981"><b>Actif</b></font>', style_table_cell), Paragraph('Accès normal à la plateforme', style_table_cell)],
        [Paragraph('<font color="#ef4444"><b>Bloqué</b></font>', style_table_cell), Paragraph('Accès bloqué (abonnement expiré ou blocage manuel admin). L\'auto-école doit payer pour réactiver.', style_table_cell)],
    ]
    t4 = Table(abo_data, colWidths=[35*mm, 125*mm])
    t4.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLUE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_GRAY]),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#cbd5e1')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(t4)

    story.append(Paragraph('6.2 Expiration automatique', style_h2))
    story.append(Paragraph(
        'Quand l\'abonnement d\'une auto-école atteint sa date d\'expiration, son statut passe automatiquement à '
        '<b>Bloqué</b>. Un scan s\'effectue au démarrage du serveur et toutes les heures. '
        'L\'auto-école est alors redirigée vers la page de paiement lors de sa prochaine tentative de connexion.', style_body))

    story.append(Paragraph('6.3 Paiement GeniusPay', style_h2))
    story.append(Paragraph(
        'Le paiement s\'effectue via l\'API GeniusPay :', style_body))
    items = [
        'L\'auto-école bloquée se connecte sur /autoecole → écran de paiement',
        'Le montant affiché est <b>dynamique</b> (défini par le Super Admin, pas en dur)',
        'Clic sur « PAYER MAINTENANT » → redirection vers le site GeniusPay',
        'Après paiement : réactivation automatique, reçu envoyé par email, redirection vers /autoecole',
        'Page de succès avec décompte 5 secondes avant redirection',
    ]
    for item in items:
        story.append(Paragraph(f'• {item}', style_bullet))

    story.append(Paragraph('6.4 Rappel d\'expiration (J-3)', style_h2))
    story.append(Paragraph(
        'Un email de rappel est envoyé automatiquement 3 jours avant l\'expiration de l\'abonnement. '
        'Le message est professionnel et inclut le nom de l\'auto-école, la date d\'expiration et un bouton '
        'de renouvellement.', style_body))

    story.append(Paragraph('6.5 Réactivation manuelle', style_h2))
    story.append(Paragraph(
        'Le Super Admin peut réactiver manuellement une auto-école bloquée via le bouton « Réactiver » '
        'dans le panel Abonnements. Cela génère une nouvelle période d\'abonnement et un reçu.', style_body))

    story.append(PageBreak())

    # ---- 7. DOCUMENTS ----
    story.append(Paragraph('7. Génération de documents', style_h1))

    story.append(Paragraph('SIGEXPC génère plusieurs types de documents officiels au format PDF :', style_body))

    doc_data = [
        [Paragraph('<b>Document</b>', style_table_header), Paragraph('<b>Généré par</b>', style_table_header), Paragraph('<b>Contenu</b>', style_table_header)],
        [Paragraph('Bordereau d\'examen', style_table_cell), Paragraph('Direction Régionale', style_table_cell), Paragraph('Liste des candidats avant délibération avec émargement', style_table_cell)],
        [Paragraph('Bordereau délibéré', style_table_cell), Paragraph('Direction / AE', style_table_cell), Paragraph('Résultats officiels : APTE, INAPTE, ABSENT, N.E.', style_table_cell)],
        [Paragraph('Compte rendu STTC', style_table_cell), Paragraph('Service STTC', style_table_cell), Paragraph('Synthèse des examens de conduite', style_table_cell)],
        [Paragraph('Rapport officiel', style_table_cell), Paragraph('Auto-École', style_table_cell), Paragraph('Rapport d\'activité périodique avec statistiques', style_table_cell)],
        [Paragraph('Reçu de paiement', style_table_cell), Paragraph('Super Admin', style_table_cell), Paragraph('Reçu d\'abonnement (envoyé par email)', style_table_cell)],
    ]
    t5 = Table(doc_data, colWidths=[35*mm, 40*mm, 85*mm])
    t5.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLUE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, LIGHT_GRAY]),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#cbd5e1')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(t5)

    story.append(Spacer(1, 15))
    story.append(Paragraph(
        'Tous les documents sont générés avec l\'en-tête officielle de la République de Côte d\'Ivoire et '
        'le nom de la direction régionale. Les noms de l\'inspecteur et du directeur régional apparaissent '
        'automatiquement dans la zone de signature.', style_body))

    story.append(PageBreak())

    # ---- 8. FAQ ----
    story.append(Paragraph('8. FAQ et dépannage', style_h1))

    faqs = [
        ('Mon auto-école est bloquée, que faire ?',
         'Connectez-vous sur https://sigexpc.onrender.com/autoecole. L\'écran de paiement s\'affichera automatiquement. '
         'Payez via GeniusPay pour réactiver votre accès immédiatement.'),
        ('Je ne vois pas mes candidats sur le bordereau',
         'Assurez-vous que la session d\'examen est bien ouverte par la Direction Régionale. Vos candidats doivent '
         'être en statut « Dossiers purs » (en attente d\'inscription). Sélectionnez-les et cliquez sur « SOUMETTRE LE BORDEREAU ».'),
        ('Comment importer plusieurs candidats d\'un coup ?',
         'Dans la salle d\'examen (Planification examens > salle d\'examen), cliquez sur « Import CSV ». '
         'Préparez un fichier CSV avec les colonnes : Nom et Prénoms, Identifiant, Catégorie.'),
        ('Le bordereau ne montre pas le nom du directeur',
         'Vérifiez que les signataires sont bien configurés dans le menu « Signataires » de la Direction Régionale. '
         'Le nom du directeur régional est automatiquement nettoyé (le préfixe « Directeur Régional || » est retiré).'),
        ('Comment changer le montant de l\'abonnement ?',
         'Le Super Admin va dans « Paramètres abonnement », saisit le nouveau montant (FCFA) et la durée (jours), '
         'puis clique sur « Enregistrer ».'),
        ('L\'application est lente au premier chargement',
         'Normal au démarrage : le serveur Initialise la base de données. Les chargements suivants sont rapides. '
         'Videz le cache du navigateur (Ctrl+Shift+R) si nécessaire.'),
        ('Où sont stockées les données ?',
         'Les données sont hébergées sur Supabase (PostgreSQL cloud), garantissant persistance et sécurité. '
         'L\'application tourne sur Render (hébergement web).'),
    ]

    for q, a in faqs:
        story.append(Paragraph(f'Q : {q}', style_h3))
        story.append(Paragraph(f'R : {a}', style_body))
        story.append(Spacer(1, 8))

    story.append(Spacer(1, 20))
    story.append(Paragraph('Support technique', style_h2))
    story.append(Paragraph(
        'Pour toute assistance technique, contactez l\'administrateur de la plateforme SIGEXPC.<br/>'
        'Site officiel : https://sigexpc.onrender.com', style_body))

    story.append(Spacer(1, 30))
    story.append(Paragraph(
        '<para alignment="center"><i>© 2026 SIGEXPC — Système de Gestion des Examens du Permis de Conduire — Côte d\'Ivoire</i></para>',
        style_note))

    return story

# ========== GÉNÉRATION ==========
def generate():
    doc = SimpleDocTemplate(OUTPUT, pagesize=A4,
                            leftMargin=20*mm, rightMargin=20*mm,
                            topMargin=20*mm, bottomMargin=30*mm,
                            title='Guide Utilisateur SIGEXPC',
                            author='SIGEXPC',
                            subject='Guide complet de la plateforme SIGEXPC')

    story = build_story()

    doc.build(story, onFirstPage=cover_page, onLaterPages=page_decoration)
    print(f'✅ Guide généré : {OUTPUT}')
    print(f'   Taille : {os.path.getsize(OUTPUT) / 1024:.0f} KB')

if __name__ == '__main__':
    generate()
