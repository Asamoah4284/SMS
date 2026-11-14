#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_school_documentation.py
================================

Generates a complete, presentation-ready **partnership & system documentation
proposal** for DEACONS SMS (the School Management System) that can be handed
to a school to evaluate, approve and adopt the platform.

It writes three artefacts into ``SMS/docs/`` (configurable):

    1. ``*.docx``  - a genuine Microsoft Word document (Open XML, hand-built
                     with nothing but the Python standard library).
    2. ``*.md``    - a Markdown version for wikis / git / easy editing.
    3. ``*.html``  - a self-contained, styled HTML version that prints
                     beautifully to PDF (Ctrl+P -> Save as PDF) and also
                     opens cleanly in Word / Google Docs.

Why no third-party libraries?
    Schools and staff often run locked-down machines. This script therefore
    depends on **only** the Python standard library, so it always runs.

Usage
-----
    python generate_school_documentation.py
    python generate_school_documentation.py --school "St. Mary's Basic School" \
        --contact-name "Kwame Mensah" --contact-phone "0200000000" \
        --contact-email "hello@deacons.dev" --outdir ..\\docs
    python generate_school_documentation.py --price-per-student 12 --formats docx,md,html

Everything that a school normally customises lives in ``CONFIG`` below or can
be overridden from the command line.
"""

from __future__ import annotations

import argparse
import datetime as _dt
import os
import struct
import sys
import zipfile
from pathlib import Path

# ---------------------------------------------------------------------------
# 1. CONFIGURATION - edit here (or override on the command line)
# ---------------------------------------------------------------------------

CONFIG = {
    # --- Identity ---------------------------------------------------------
    "product": "DEACONS SMS",
    "product_full": "DEACONS School Management System",
    "vendor": "DEACONS Technologies",
    "tagline": "Excellence in Education",
    "document_title": "School Management System",
    "document_subtitle": "Partnership & System Documentation Proposal",
    "doc_version": "1.0",
    "doc_date": "",  # blank => today's date

    # --- Audience ---------------------------------------------------------
    "prepared_for": "[Name of School] - The Board, Head Teacher & Management",
    "prepared_by": "DEACONS Technologies - Product & Partnerships Team",

    # --- Commercials ------------------------------------------------------
    "currency_symbol": "\u20b5",          # Ghana Cedi sign
    "currency_code": "GHS",
    "price_per_student_term": 10,          # GHS per active student per term
    "implementation_fee": 0,               # free onboarding by default
    "training_sessions_included": 3,

    # --- Contact ----------------------------------------------------------
    "contact_name": "[Your Name]",
    "contact_role": "Partnerships Lead",
    "contact_phone": "[Your Phone]",
    "contact_alt_phone": "[Alt Phone]",
    "contact_email": "[you@yourcompany.com]",
    "contact_website": "[www.yourcompany.com]",
    "contact_location": "Accra, Ghana",

    # --- Cover logo (first existing file wins; PNG or JPEG) ---------------
    "logo_candidates": [
        "frontend/public/school-logo.png",
        "frontend/public/images/logo.png",
        "backend/src/logo.png",
    ],
}

# Brand colours used across all three output formats.
PRIMARY = "1D4ED8"      # deep blue  - headings / table headers
ACCENT = "0F766E"       # teal       - highlights
INK = "111827"          # near-black body text
MUTED = "6B7280"        # grey captions
HEADER_FILL = PRIMARY
ROW_FILL = "F3F4F6"
CALLOUT_FILLS = {
    "info": "EFF6FF",
    "success": "ECFDF5",
    "warn": "FFFBEB",
    "danger": "FEF2F2",
}
CALLOUT_BORDERS = {
    "info": "1D4ED8",
    "success": "059669",
    "warn": "D97706",
    "danger": "DC2626",
}


# ---------------------------------------------------------------------------
# 2. CONTENT MODEL - tiny, renderer-agnostic block helpers.
#    A document is just a list of these dicts, so the same content drives the
#    .docx, .md and .html renderers.
# ---------------------------------------------------------------------------

def h1(text):  return {"t": "h1", "text": text}
def h2(text):  return {"t": "h2", "text": text}
def h3(text):  return {"t": "h3", "text": text}
def p(text):   return {"t": "p", "text": text}
def lead(text): return {"t": "lead", "text": text}
def bullets(items, level=0): return {"t": "bullets", "items": list(items), "level": level}
def numbered(items): return {"t": "numbered", "items": list(items)}
def quote(text, source=None): return {"t": "quote", "text": text, "source": source}
def callout(title, text, kind="info"):
    return {"t": "callout", "title": title, "text": text, "kind": kind}
def table(headers, rows, widths=None, caption=None, note=None):
    return {"t": "table", "headers": list(headers), "rows": [list(r) for r in rows],
            "widths": widths, "caption": caption, "note": note}
def kv(pairs): return {"t": "kv", "pairs": [list(x) for x in pairs]}
def pagebreak(): return {"t": "pagebreak"}
def hr(): return {"t": "hr"}
def spacer(n=1): return {"t": "spacer", "n": n}
def toc(): return {"t": "toc"}
def signature_block(): return {"t": "signature"}

# ---------------------------------------------------------------------------
# 3. DOCUMENT CONTENT
# ---------------------------------------------------------------------------

def _money(cfg, amount):
    if float(amount).is_integer():
        return "%s%s" % (cfg["currency_symbol"], format(int(amount), ","))
    return "%s%s" % (cfg["currency_symbol"], format(amount, ",.2f"))


def _cover(cfg):
    return {
        "t": "cover",
        "eyebrow": cfg["vendor"].upper(),
        "title": cfg["product_full"],
        "subtitle": cfg["document_subtitle"],
        "tagline": cfg["tagline"],
        "logo": True,
        "meta": [
            ("Prepared for", cfg["prepared_for"]),
            ("Prepared by", cfg["prepared_by"]),
            ("Document", "%s v%s" % (cfg["product"], cfg["doc_version"])),
            ("Date", cfg["doc_date"] or _dt.date.today().strftime("%d %B %Y")),
            ("Status", "Issued for review and approval"),
        ],
    }


def _front_matter(cfg):
    return [
        _cover(cfg),
        pagebreak(),
        h1("Document Control"),
        p("This document is issued to the management of [Name of School] so that the "
          "school can fully understand, evaluate and approve the %s platform." %
          cfg["product"]),
        kv([
            ("Document title", "%s - %s" % (cfg["product_full"], cfg["document_subtitle"])),
            ("Product", cfg["product"]),
            ("Platform owner", cfg["vendor"]),
            ("Version", cfg["doc_version"]),
            ("Date of issue", cfg["doc_date"] or _dt.date.today().strftime("%d %B %Y")),
            ("Classification", "Confidential - for the named recipient only"),
            ("Primary contact", "%s, %s" % (cfg["contact_name"], cfg["contact_role"])),
            ("Contact phone", cfg["contact_phone"]),
            ("Contact email", cfg["contact_email"]),
        ]),
        h2("How to read this document"),
        bullets([
            "**Sections 1-4** explain the business case - what the school gains, what changes from "
            "day one, and what it costs.",
            "**Sections 5-7** are the complete feature specification: every module, what each role "
            "can see and do, and a summary register the board can use as a scorecard.",
            "**Sections 8-9** cover the technology and the deployment in plain language - security, "
            "data protection, ownership, and how a school actually goes live.",
            "**Sections 10-12** cover training, support and data migration: the parts that decide "
            "whether the system is genuinely used after the first month.",
            "**Sections 13-14** cover pricing, commercial terms, timing, and the decisions the board "
            "needs to make - ending with a sign-off page.",
            "**Appendices A-E** are the working reference: grading and report-card rules, a "
            "glossary, the data templates, a readiness checklist, and the document control log.",
        ]),
        toc(),
        pagebreak(),
    ]


def _executive_summary(cfg):
    today = cfg["doc_date"] or _dt.date.today().strftime("%d %B %Y")
    return [
        h1("1. Executive Summary"),
        lead("%s is a complete, production-ready school management platform built "
             "specifically for Ghanaian basic schools - from Cr\u00e8che and Nursery "
             "through to JHS 3. It replaces paper registers, scattered spreadsheets "
             "and WhatsApp groups with one dependable system that runs in the browser "
             "on any phone, tablet or laptop." % cfg["product"]),
        p("Every school runs on the same scarce resources: teacher time, parent trust "
          "and predictable income. This platform protects all three. Attendance, "
          "results, fees, timetables and communication are captured once, at the point "
          "of work, and then flow automatically to every report, receipt, report card "
          "and parent notification that needs them."),
        h2("What the school gets"),
        bullets([
            "**One source of truth** for every student, guardian, teacher, class and subject.",
            "**Automatic school reports** - attendance summaries, GES-graded results, class rankings and printable report cards.",
            "**Faster, more transparent fee collection** - fee structures, payment status, receipts, defaulter lists and online mobile-money payment.",
            "**Stronger parent engagement** - a self-service parent portal plus automatic SMS and push notifications.",
            "**Less administrative work** - bulk CSV import, auto-generated student and staff IDs, automatic teacher check-in.",
            "**Modern assessment** - computer-based testing (CBT) with automatic marking, alongside traditional class tests and exams.",
            "**Complete data ownership** - the school's data is isolated, exportable and never resold.",
        ]),
        h2("Commercial summary"),
        table(
            ["Item", "Terms"],
            [
                ["Licence model", "Subscription per active student, per term"],
                ["Unit price", "%s per active student per term" % _money(cfg, cfg["price_per_student_term"])],
                ["Implementation fee", "None - free onboarding" if not cfg["implementation_fee"] else _money(cfg, cfg["implementation_fee"])],
                ["Training", "%s live training sessions included" % cfg["training_sessions_included"]],
                ["Hardware required", "None - runs in the browser; no server needed at the school"],
                ["Contract", "Term by term; no long lock-in"],
            ],
            widths=[2, 5],
            caption="Summary of commercial terms offered to [Name of School].",
        ),
        callout("Why act this term?",
                "Every term that passes without a system is a term of manual "
                "reconciliation: unrecorded fees, missing attendance and report cards "
                "typed by hand. Rolling out at the start of a term means the school "
                "starts clean - enrolment, timetable and fee structure are loaded once, "
                "and everything afterwards is captured automatically.",
                kind="info"),
        p("The remainder of this document sets out the full capability of the platform, "
          "how it is secured and deployed, exactly how onboarding works, and the "
          "commercial terms. We would be glad to give the management team a live "
          "walk-through at your convenience."),
        p("_Issued %s by %s._" % (today, cfg["vendor"])),
        pagebreak(),
    ]


def _why_partner(cfg):
    unit = _money(cfg, cfg["price_per_student_term"])
    return [
        h1("2. Why Partner With Us"),
        lead("Schools do not buy software - they buy time, trust and control. Here is "
             "what changes from day one of using %s." % cfg["product"]),

        h2("2.1  The problems we remove"),
        table(
            ["Today (manual / spreadsheet)", "With %s" % cfg["product"]],
            [
                ["Attendance written in paper registers, summarised by hand.",
                 "Marked once on a phone in seconds; monthly and termly summaries are automatic."],
                ["Results computed in spreadsheets; grade and position errors reach parents.",
                 "Scores entered once; GES grades (A1-F9), totals, subject positions and class rankings are calculated by the system."],
                ["Report cards typed and re-typed for every pupil, every term.",
                 "Report cards generated and printed for a whole class, with teacher and headmaster remarks, conduct and interest."],
                ["Fees tracked in a ledger; parents dispute balances.",
                 "Live fee status per student (fully paid / half paid / partial / unpaid), receipts, defaulter lists and an online payment option."],
                ["Parents call the school for every question.",
                 "A read-only parent portal showing attendance, results, fees and downloadable report cards."],
                ["Staff attendance and leave tracked informally.",
                 "Teacher check-in recorded automatically on login; leave requests submitted and approved in-app with automatic SMS."],
                ["Admission forms completed one pupil at a time.",
                 "Bulk CSV import: an entire class - or an entire school - loaded from a single file."],
                ["Important information arrives late, by word of mouth.",
                 "Announcements plus automatic SMS and push notifications sent to the right audience only."],
            ],
            widths=[3, 3],
            caption="Manual workflow versus the platform workflow.",
        ),

        h2("2.2  The measurable wins"),
        bullets([
            "**Administrative time:** work that took days per term (report cards, fee reconciliation, attendance summaries) completes in minutes.",
            "**Fee leakage:** an unambiguous, auditable record of every payment reduces disputes and makes arrears recoverable.",
            "**Parent satisfaction:** parents see progress and balances instantly, without calling the school.",
            "**Teacher accountability:** automatic check-in and leave records give an objective picture for payroll and supervision.",
            "**Better decisions:** dashboards show enrolment, attendance rate, collection rate and subject performance at a glance.",
            "**Inspection readiness:** complete, consistent records are always available for GES and board review.",
        ]),
    ]


def _roi_and_differentiators(cfg):
    unit = _money(cfg, cfg["price_per_student_term"])
    return [
        h2("2.3  Illustrative return on investment"),
        p("The table below models a school of **400 pupils**. It is illustrative only - "
          "every school's baseline differs - but it shows how a small per-pupil fee is "
          "quickly outweighed by time recovered and arrears made visible."),
        table(
            ["Value driver", "Assumption", "Value per term"],
            [
                ["Term licence cost",
                 "400 active pupils x %s" % unit,
                 "%s" % _money(cfg, 400 * cfg["price_per_student_term"])],
                ["Administrative time recovered",
                 "Registers, report cards and reconciliation - about 120 staff-hours saved at %s/hour" % _money(cfg, 15),
                 "%s recovered" % _money(cfg, 120 * 15)],
                ["Fee arrears made visible",
                 "5 pupils' previously untracked balances recovered (average %s each)" % _money(cfg, 300),
                 "%s recovered" % _money(cfg, 5 * 300)],
                ["Parent queries reduced",
                 "Fewer phone calls and office visits",
                 "Large goodwill gain"],
            ],
            widths=[2.2, 3.4, 1.6],
            caption="Illustrative model for a 400-pupil school. Figures are examples, not a forecast.",
        ),
        callout("The bottom line",
                "For a school of 400 pupils the platform costs %s per term. Recovering "
                "a single invoice of arrears, or saving a fraction of the hours above, "
                "pays for the platform several times over." %
                _money(cfg, 400 * cfg["price_per_student_term"]),
                kind="success"),

        h2("2.4  What makes %s different" % cfg["vendor"]),
        bullets([
            "**Built for Ghana, not adapted to it** - Ghana Cedi fees, GES A1-F9 grading, Nursery/KG/Basic/JHS class structure, Ghanaian phone-number validation and local SMS gateways.",
            "**One school, one instance** - the school's data lives in its own isolated deployment. Nothing is shared with other schools.",
            "**No hardware to buy** - no server, no software licences, no installation. A browser is the only requirement.",
            "**Works on modest devices** - light, fast pages designed for low bandwidth and entry-level Android phones.",
            "**Proven, real codebase** - a full Express + PostgreSQL API and a Next.js front end with dozens of production modules already built.",
            "**The school keeps its data** - full export on request at any time, including after the relationship ends.",
            "**No lock-in** - term-by-term terms. If it does not deliver value, the school can stop.",
        ]),

        h2("2.5  What we ask of the school"),
        p("This is a partnership, not a software download. To succeed, we ask for a "
          "small amount of commitment from the school:"),
        numbered([
            "A single **staff champion** (typically the Head Teacher or an IT/administrative officer) to coordinate the rollout.",
            "**Access to accurate enrolment data** - the class list, guardian contact numbers and fee structure for the current term.",
            "A **one-hour kick-off meeting** with management to confirm scope and the go-live date.",
            "**Attendance at the training sessions** by the teachers and office staff who will use the system daily.",
            "A **review at the end of the first term** so that we can tune the configuration to how the school actually works.",
        ]),
        callout("Our commitment in return",
                "We configure the platform for the school, load the opening data, train "
                "the staff, stay available throughout the first term, and only bill for "
                "active students. If the school does not see value in the first term, "
                "there is no obligation to continue.",
                kind="success"),
        pagebreak(),
    ]


def _about_system(cfg):
    return [
        h1("3. About the System"),
        lead("%s is a single, integrated web platform that manages the academic, "
             "administrative and financial life of a basic school. It is delivered as "
             "one private instance per school, so each school has its own database and "
             "its own branded portal." % cfg["product"]),

        h2("3.1  What the system is"),
        p("The platform is made up of four cooperating parts:"),
        bullets([
            "**The school dashboard** - the main web application used by the Head Teacher, "
            "administrators and teachers to run day-to-day school operations.",
            "**The parent portal** - a separate, read-only area where a parent enters the "
            "guardian phone number already recorded for the child and immediately sees "
            "only that child's (or those children's) records.",
            "**The student portal** - a secure area used by pupils to sit computer-based "
            "tests and see released results.",
            "**The API and database** - the secure back end that stores all records, "
            "enforces permissions and integrates with SMS and mobile-money providers.",
        ]),
        p("All three portals are served from the same platform and the same data, so a "
          "record entered once by a teacher is immediately visible to the parent, the "
          "office and the management dashboard - with no re-typing and no version "
          "conflict."),

        h2("3.2  Who it is designed for"),
        p("The platform covers the complete Ghanaian basic-school journey. Class levels "
          "are first-class concepts in the system, not free text, which is what makes "
          "reporting, promotion and fee structures reliable."),
        table(
            ["Stage", "Class levels supported"],
            [
                ["Early childhood", "Cr\u00e8che, Nursery 1, Nursery 2"],
                ["Kindergarten", "KG 1, KG 2"],
                ["Lower / Upper Primary", "Basic 1 - Basic 6 (also modelled as Year 1 - Year 8)"],
                ["Junior High School", "JHS 1, JHS 2, JHS 3"],
                ["Sections", "Optional per-level sections, e.g. Basic 4A and Basic 4B"],
            ],
            widths=[2.4, 4.6],
        ),

        h2("3.3  How it is deployed (one school, one instance)"),
        p("Each school receives its own deployment: its own web address, its own "
          "database and its own configuration. This is a deliberate design decision, "
          "and it is the single most important difference between %s and shared, "
          "multi-tenant school apps." % cfg["product"]),
        bullets([
            "**Total isolation** - the school's records are physically separate from every other school.",
            "**School branding** - the school's name, motto, address, logo, phone and email appear throughout the platform.",
            "**Custom class levels** - the class structure is configured to match the school exactly.",
            "**No cross-school reporting** - nothing about the school's staff, pupils or finances is visible to anyone else.",
            "**Simple exit** - because the deployment is independent, the school's data can be exported in full at any time.",
        ]),

        h2("3.4  User roles"),
        table(
            ["Role", "Who it is for", "What they can do"],
            [
                ["Administrator",
                 "Head Teacher, school office, proprietor",
                 "Full control: students, staff, classes, subjects, timetable, results, fees, announcements, library, promotions, settings and reports."],
                ["Teacher",
                 "Class teachers and subject teachers",
                 "See their class and subjects; mark attendance; create assessments and enter scores; generate results; upload lesson notes; request leave."],
                ["Parent / Guardian",
                 "Parents and guardians",
                 "Read-only: their child's attendance, results, fees, report cards, timetable and school announcements."],
                ["Student",
                 "Pupils",
                 "Sit published online exams (computer-based tests) and view released results."],
            ],
            widths=[1.4, 2.2, 3.6],
            caption="The platform implements strict role-based access control; each role only ever sees what it needs.",
        ),
    ]


def _platform_at_a_glance(cfg):
    return [
        h1("4. Platform at a Glance"),
        table(
            ["Metric", "Detail"],
            [
                ["Purpose-built for", "Ghanaian basic schools (Cr\u00e8che to JHS 3)"],
                ["Major functional modules", "20+"],
                ["User roles", "4 (Administrator, Teacher, Parent, Student)"],
                ["Database entities modelled", "40+"],
                ["Back-office API route groups", "26"],
                ["Documented API endpoints", "170+"],
                ["Access", "Any modern browser - phone, tablet, laptop or desktop"],
                ["Offline installation needed", "None"],
                ["Report outputs", "PDF report cards, printable receipts, CSV/Excel exports"],
                ["Notification channels", "In-app, SMS, mobile push"],
                ["Online payments", "Mobile money via Moolre MoMo checkout; settled to the school wallet with payout requests"],
                ["Data ownership", "100% the school's, exportable on demand"],
            ],
            widths=[2.6, 4.4],
            caption="A snapshot of the scale and completeness of the platform.",
        ),
        h2("4.1  Technology stack"),
        p("The platform is built on a modern, well-supported and widely understood "
          "stack. This matters to a school because it means the system is maintainable, "
          "hosting is inexpensive and cheap to run, and there is a large talent pool "
          "familiar with every component - no exotic technology that only one person "
          "can support."),
        table(
            ["Layer", "Technology", "Why it was chosen"],
            [
                ["User interface", "Next.js 16 + React 19 + Tailwind CSS 4",
                 "Fast, mobile-first, works on low-end devices; server-rendered pages load quickly on weak connections."],
                ["Programming language", "TypeScript / JavaScript",
                 "Type safety in the front end reduces bugs; one language across the whole team."],
                ["API / business logic", "Node.js 20+ with Express 5",
                 "Mature, high-performance and easy to host."],
                ["Database", "PostgreSQL 15+",
                 "World-class reliability and data integrity for financial and academic records."],
                ["Data access layer", "Prisma ORM",
                 "Every database change is a reviewed, versioned migration - safe, auditable schema evolution."],
                ["Authentication", "JSON Web Tokens (access + refresh tokens)",
                 "Industry-standard secure sessions with automatic token refresh."],
                ["SMS gateway", "Hubtel (default) or Arkesel - HTTP API",
                 "Reliable delivery to Ghanaian networks with a configurable sender ID; the provider can be switched without changing the platform."],
                ["Payments", "Moolre mobile-money embed checkout",
                 "Parents pay fees and book costs with the mobile money they already use, on the phone they already have - no card required."],
                ["School settlement", "School wallet with payout requests",
                 "Collected money is credited to the school's wallet and paid out on request, with an alert to management on every request."],
                ["File storage", "Server storage with size and type limits",
                 "Passport photos, lesson notes, book covers and report assets."],
                ["Push notifications", "Expo push service",
                 "Reaches parents inside the companion mobile app."],
            ],
            widths=[1.5, 2.3, 3.2],
            caption="Technology stack and the reasoning behind each choice.",
        ),
        callout("No vendor lock-in",
                "Every component is open, mainstream technology. If the school ever "
                "needs to move the platform, or another developer needs to maintain it, "
                "nothing stands in the way.",
                kind="info"),
    ]


def _modules_intro(cfg):
    return [
        pagebreak(),
        h1("5. Module-by-Module Feature Specification"),
        lead("This section is the complete functional specification of the platform. "
             "Each module below is implemented in the shipping product - it is not a "
             "roadmap or a concept. Together they cover every routine task a basic "
             "school performs in a term."),
        table(
            ["#", "Module", "One-line summary"],
            [
                ["5.1", "Academic Calendar & Terms", "Define the academic year, its three terms and the active term."],
                ["5.2", "Student Management", "Enrolment, auto IDs, records, photos, class transfers and bulk import."],
                ["5.3", "Class Management", "Class levels, sections, class teachers and class rosters."],
                ["5.4", "Subject Management", "Subjects, subject codes and subject-teacher-class assignment."],
                ["5.5", "Teacher Management", "Staff records plus SMS-based invitation onboarding with staff IDs."],
                ["5.6", "Guardian Management", "Guardian records linked to one or many children."],
                ["5.7", "Student Attendance", "Daily attendance capture with monthly and termly summaries."],
                ["5.8", "Teacher Attendance & Leave", "Automatic check-in on login and digital leave requests."],
                ["5.9", "Examinations & Results", "Assessments, GES grading, rankings, remarks and report cards."],
                ["5.10", "Computer-Based Testing", "Online exams with automatic marking and timed sittings."],
                ["5.11", "Fees & Payments", "Fee structures, payment capture, receipts and online mobile money."],
                ["5.12", "Textbook Management", "Book catalogue, class/pupil assignment and book payments."],
                ["5.13", "Library & Lesson Notes", "Digital materials and lesson-note library by class and subject."],
                ["5.14", "Timetable", "Weekly class timetable with conflict detection and auto-generation."],
                ["5.15", "Promotions", "End-of-term bulk promotion with per-pupil decisions."],
                ["5.16", "Announcements & Events", "Targeted announcements, school events and multi-channel alerts."],
                ["5.17", "Certificates", "Generate completion, excellence and participation certificates."],
                ["5.18", "Parent Portal", "Read-only child dashboard for attendance, results, fees and reports."],
                ["5.19", "Student Portal", "Pupil login to sit tests and view released results."],
                ["5.20", "Reports & Analytics", "Enrolment, attendance, collections and academic performance analytics."],
                ["5.21", "Settings & Branding", "School identity, users, terms and configuration."],
            ],
            widths=[0.7, 2.2, 4.1],
            caption="Complete index of functional modules.",
        ),
    ]


def _module_academic(cfg):
    return [
        h2("5.1  Academic Calendar & Terms"),
        p("Everything academic in the platform is anchored to a term. Getting this right "
          "once means attendance, results, fees and promotions all stay correctly "
          "attributed for the rest of the year."),
        bullets([
            "Define academic **years** (for example 2025/2026).",
            "Create the **three terms** - First, Second and Third - each with a start date and an end date.",
            "Mark exactly one term as the **current term**; the whole platform reads from it.",
            "Keep historical terms intact forever, giving full multi-year continuity.",
            "Configure the school's **event and holiday calendar** alongside the terms.",
        ]),
        callout("Why it matters",
                "Because every attendance record, assessment, fee payment and report "
                "card is stamped with its term, the school can always produce a "
                "defensible historical record - even years later.",
                kind="info"),
    ]


def _module_students(cfg):
    return [
        h2("5.2  Student Management"),
        p("The student record is the heart of the platform. Admission, attendance, "
          "results, fees, report cards and the parent portal all hang off it, so the "
          "student module is designed to capture everything the school needs - once."),
        bullets([
            "**Complete pupil profile**: first, middle and last name, gender, date of birth, place of birth, nationality and hometown.",
            "**Automatic student ID generation**, so no two pupils ever share an identifier and IDs never need to be invented by hand.",
            "**Automatic admission numbering** with a configurable prefix (for example the year of admission).",
            "**Passport photograph** upload, shown in the dashboard, in the parent portal and on the report card.",
            "**Guardian linkage** - each pupil is attached to one or more guardians, with a designated primary contact.",
            "**Enrolment status** tracking (active, transferred, graduated, withdrawn) so leavers drop out of registers without deleting history.",
            "**Class and section placement**, with transfer between classes handled as a recorded event rather than an edit.",
            "**Custom fields** for anything the school additionally tracks - house, religious denomination, medical notes, boarding status.",
            "**Full search and filtering** by name, class, status, admission number or student ID.",
            "**Bulk CSV import** - the single most powerful onboarding tool: load an entire school from a spreadsheet, with validation and a clear error report for rejected rows.",
        ]),
        callout("Bulk import saves days of data entry",
                "Rather than typing hundreds of pupils one at a time, the school "
                "supplies a spreadsheet. The platform validates every row, previews the "
                "import, reports any problems, and creates the records - classes, "
                "guardians and student IDs included.",
                kind="success"),
    ]


def _module_classes_subjects(cfg):
    return [
        h2("5.3  Class Management"),
        p("Classes are structured exactly the way a Ghanaian basic school is run: a "
          "level (Basic 4), an optional section (A/B), a class teacher and a roster of "
          "pupils."),
        bullets([
            "Create classes for **Cr\u00e8che and Nursery, KG, Basic 1-6 and JHS 1-3**.",
            "Support **multiple sections per level** (Basic 3A, Basic 3B) with independent rosters.",
            "Assign a **class teacher** to each class - that teacher then owns the class register.",
            "Assign **subject teachers** per class and subject, so a teacher only sees the pupils and subjects that concern them.",
            "View the **class roster** with photographs, IDs, guardians and fee status in one list.",
            "Track the **number of pupils per class** for planning, staffing and GES reporting.",
            "Assign a **fee structure** to a class, so fees are automatically applied to every pupil in it.",
            "Set a **class promotion target** (Basic 3 promotes to Basic 4) for the end-of-year promotion run.",
        ]),

        h2("5.4  Subject Management"),
        bullets([
            "Maintain a **subject catalogue** with subject names and short codes.",
            "Mark subjects as **core or elective**, so they are treated correctly when computing totals and averages.",
            "Assign subjects to classes, giving a **per-class subject list** rather than one global list.",
            "Assign a **subject teacher to each subject-class pair**, enabling teacher-specific score entry.",
            "Support subjects across the whole school - Mathematics, English Language, Integrated Science, Social Studies, Ghanaian Language, Religious and Moral Education, Information and Communications Technology, Creative Arts, French, Career Technology and more.",
            "Configure **subject weightings** and which subjects count towards the aggregate used for ranking and placement.",
            "Retire subjects without deleting history, keeping past terms reproducible.",
        ]),
        callout("Accurate by construction",
                "Because classes, subjects and their assignments are structured data, "
                "the platform can never compute a result or a fee for a pupil in a "
                "subject or class they are not enrolled in.",
                kind="info"),
    ]


def _module_teachers(cfg):
    return [
        h2("5.5  Teacher & Staff Management"),
        p("Staff records, teacher accounts, class assignments and staff IDs are managed "
          "in a single module, so the school always knows who is on the staff, what "
          "they teach and whether they are in school."),
        bullets([
            "**Complete staff profile**: personal details, contact number, email address, gender, date of birth and address.",
            "**Automatic staff ID generation** with a configurable prefix, giving every employee a unique reference.",
            "**Employment details**: role, qualification, subject specialities, date of appointment and status.",
            "**Invitation-based onboarding** - the administrator adds a teacher's phone number and the platform sends an SMS invitation. The teacher sets their own password through a secure link; the administrator never handles passwords.",
            "**Account status control** - activate or deactivate a teacher's access instantly (for example on suspension or exit).",
            "**Password reset via SMS** - a teacher who forgets a password receives a verification code on their registered phone number.",
            "**Assignment overview** - see at a glance which classes and subjects each teacher owns.",
            "**Automatic check-in** - the teacher's daily attendance is recorded when they log in to the platform.",
            "**Leave management** - teachers submit leave requests in-app; the administrator approves or rejects, and the teacher is notified automatically by SMS.",
            "**Teacher attendance history** - a complete record of logins, absences and approved leave for supervision and payroll.",
        ]),
        callout("No shared passwords, no paper forms",
                "Invitations are delivered by SMS, so a new teacher is productive "
                "within minutes of being added to the system - and the school has a "
                "clean, auditable record of exactly who was granted access and when.",
                kind="info"),

        h2("5.6  Guardian Management"),
        bullets([
            "**Guardian records** with name, relationship to the child, phone number, alternate phone, email and address.",
            "**One guardian, many children** - a single parent account follows every child enrolled in the school (a very common case for siblings).",
            "**Primary contact designation**, used to decide which number receives fee reminders and results.",
            "**Parent portal access** from the guardian record - the parent simply enters the registered phone number, with no separate account to create and no password to forget.",
            "**Validation of Ghanaian phone numbers** at entry, so SMS alerts always reach a correctly formatted number.",
            "**Bulk guardian import** alongside pupil import, so onboarding data arrives once and links correctly.",
            "**Automatic SMS on key events** - fee payment received, results released, leave approvals, announcements and reminders.",
        ]),
    ]


def _module_attendance(cfg):
    return [
        h2("5.7  Student Attendance"),
        p("Attendance is the highest-frequency task in any school and therefore the "
          "one that most often gets abandoned. This module is designed to be fast "
          "enough to actually be used - a whole class can be marked in under a minute "
          "on a phone."),
        bullets([
            "**Daily marking** for every class, with present, absent, late and excused states.",
            "**One-tap marking** - pupils default to present and the teacher only adjusts exceptions, rather than tapping every child individually.",
            "**Once-per-day integrity** - the platform prevents duplicate registers for the same class and date, so the figures can be trusted.",
            "**Automatic termly and monthly summaries** - days present, days absent, total school days and percentage attendance per pupil.",
            "**Attendance percentage** feeds straight into the report card and the parent portal.",
            "**Class-level attendance rate** for the management dashboard, showing which classes are struggling.",
            "**Correction with an audit trail** - a register can be amended by authorised staff, and the change is recorded.",
            "**Print and export** attendance summaries for GES returns, board meetings or a parent conversation.",
            "**Attendance trends** - spot a pupil whose attendance is slipping, or a class where Friday attendance is poor.",
        ]),
        callout("Attendance is the early-warning system",
                "Persistent absence is the earliest indicator of a child at risk of "
                "dropping out, and of fees going unpaid. Automatic attendance reporting "
                "turns a week of paper registers into a single, actionable number.",
                kind="warning"),

        h2("5.8  Teacher Attendance & Leave"),
        bullets([
            "**Automatic check-in** - a teacher's attendance for the day is recorded the moment they log in; no separate register to maintain.",
            "**Login time, date and frequency** captured for every staff member.",
            "**Staff attendance history** by day, week, month and term.",
            "**Digital leave requests** - a teacher submits a request with type, dates and reason directly in the platform.",
            "**Approval workflow** - the administrator approves or rejects with a note; the requesting teacher is notified automatically by SMS.",
            "**Leave balances and history** retained per staff member, making entitlements easy to monitor.",
            "**Objective evidence** for payroll, supervision and disciplinary matters.",
        ]),
    ]


def _module_results(cfg):
    return [
        h2("5.9  Examinations, Assessments & GES Results"),
        p("This is the module that saves teachers the most time and produces the "
          "artefact parents judge the school by: the terminal report card. Scores are "
          "entered once and everything else - grades, totals, averages, positions, "
          "remarks and the printed report - is computed by the platform using the "
          "Ghana Education Service grading scale."),
        h3("Assessments"),
        bullets([
            "Create **any number of assessments per subject per term** - class tests, exercises, projects and end-of-term examinations.",
            "Define each assessment with a **name, type and maximum mark**, so totals are always correct.",
            "Support the standard **Ghanaian weighting model** (for example 30% continuous assessment and 70% examination) through configurable max marks.",
            "Enter scores by **subject and class** in a grid, or import them from a spreadsheet.",
            "Scores are **validated at entry** - the platform rejects marks above the maximum or below zero.",
        ]),
        h3("Grading and computation"),
        table(
            ["Computation", "How the platform does it"],
            [
                ["Subject grade", "Converted automatically to the GES A1 - F9 scale using configurable grade boundaries."],
                ["Subject total", "Sum of all assessment scores for the subject in the term."],
                ["Subject average", "Total expressed as a percentage."],
                ["Position in subject", "The pupil's rank within the class for that subject."],
                ["Overall total", "Sum of all subject totals."],
                ["Overall average", "Total divided by the number of subjects."],
                ["Overall position", "The pupil's rank in the class across all subjects."],
                ["Aggregate", "Best-six aggregate calculated for JHS placement reporting."],
                ["Class statistics", "Class average, highest, lowest and number on roll - printed on the report for context."],
            ],
            widths=[2.1, 4.9],
        ),
        bullets([
            "**Teacher and headmaster remarks** recorded per pupil, with standard remark templates for speed.",
            "**Conduct and interest / attitude** fields, as required on Ghanaian report cards.",
            "**Attendance percentage** pulled automatically from the attendance module onto the report.",
            "**Report cards generated for a whole class at once** and printed individually or as a batch.",
            "**Results released or held** - the school decides when results become visible to parents and pupils.",
            "**Historical results preserved** for every term and year, giving a full academic history per pupil.",
            "**Broadsheet / merit list export** for whole-class and whole-school comparison.",
        ]),
        callout("From a week of work to an afternoon",
                "In a manual process, computing grades, positions and remarks for a "
                "class of forty and typing forty report cards is several days of work "
                "per subject teacher. In the platform, the teacher enters the marks once "
                "and prints the class set.",
                kind="success"),
    ]


def _module_cbt(cfg):
    return [
        h2("5.10  Computer-Based Testing (Online Exams)"),
        p("The platform includes a full computer-based testing engine. Pupils log in to "
          "the student portal and sit an examination on screen; the system marks it "
          "automatically, shows the marks to the teacher instantly, and releases results "
          "only when the school decides to. This is a genuine differentiator - most "
          "school systems in the market have no online assessment at all."),
        bullets([
            "**Question banks** organised by class, subject and topic.",
            "**Multiple-choice questions** with a configurable number of options and a single correct answer.",
            "**Configurable exams** - title, subject, class, duration, total marks, pass mark, instructions and availability window.",
            "**Timed sittings** enforced by the platform, with automatic submission when time expires.",
            "**Randomised question and option order** per candidate to discourage copying.",
            "**Question count control** - the school sets how many questions to draw from the bank for each sitting.",
            "**Automatic marking** - scores and percentage are calculated the instant the pupil submits.",
            "**Answers saved as the pupil works**, so a lost connection does not lose the paper.",
            "**Attempt limits** and one-sitting rules to preserve examination integrity.",
            "**Results held, then released** - the teacher reviews the marks and publishes when ready.",
            "**Per-question analytics** - see which questions the whole class got wrong, and reteach accordingly.",
            "**Pupils sit from any device** - a school tablet, a computer room machine, or their own phone.",
        ]),
        callout("Assessment that improves teaching",
                "Because every answer is stored, the school can see exactly which topics "
                "a class has not understood - not merely which pupils failed. That is "
                "information a paper test can never give back in usable form.",
                kind="info"),
    ]


def _module_fees(cfg):
    return [
        h2("5.11  Fees, Payments & Online Collection"),
        p("Fee collection is where a school feels the difference most quickly. The "
          "platform replaces the exercise book or spreadsheet ledger with a live, "
          "auditable position for every pupil - and gives parents a legitimate, "
          "convenient way to pay by mobile money."),
        h3("Fee structures"),
        bullets([
            "Create **named fee structures** - `Basic 1-3 Fees`, `Robotics`, `Uniform`, `Feeding`, `PTA Levy`, `Examination Fee`.",
            "Set the **amount in Ghana Cedis**, a **category** (tuition, or another charge), and whether the fee is **required or optional**.",
            "Attach a fee structure to a **class or class level**, so the correct charges apply automatically to the right pupils.",
            "Attach fee structures to a **term**, keeping each term's billing self-contained.",
            "Add explanatory **notes** shown to staff - for example `KG1 - JHS`.",
        ]),
        h3("Recording and tracking payments"),
        bullets([
            "Record payments taken at the office with **amount, method (cash, mobile money or bank), receipt number and date**.",
            "The platform computes each pupil's **total billed, total paid, balance and status** automatically.",
            "Live status per pupil: **Fully Paid, Half Paid, Partial, Unpaid** - or `No Fee Set` where no structure has been assigned.",
            "**Fee grid by class** - see every pupil's position on one screen and filter to unpaid or partly paid pupils instantly.",
            "**Receipt numbers** retained on every payment record, so every cedi can be traced to a document.",
            "**Defaulter lists** generated on demand, with guardian names and phone numbers ready for follow-up.",
            "**Per-term and per-year collection reports** showing billed against collected, and the collection rate.",
        ]),
    ]


def _module_fees_online(cfg):
    return [
        h3("Online payment by mobile money (the parent experience)"),
        numbered([
            "The parent opens the **parent portal** and sees the outstanding balance and the individual fee lines.",
            "The parent chooses **what to pay for** - settle the whole account, or target a specific item such as the examination fee - and taps Pay.",
            "The platform opens the **mobile-money checkout**; the parent approves the prompt on their phone.",
            "On success the payment is recorded against the pupil's fee lines automatically, the fee position updates instantly, and the school is credited.",
            "The parent and the school office both receive **automatic SMS confirmation**.",
        ]),
        p("Parents never handle cash at the gate, and the office no longer reconciles "
          "a stack of handwritten receipts against a register."),
        h3("Settlement, school wallet and payouts"),
        table(
            ["Item", "How it works"],
            [
                ["Gross charge to parent", "The fee amount plus a small platform transaction fee, shown transparently before payment."],
                ["Net to the school", "The full fee amount is credited to the school - the transaction fee is charged to the parent, not deducted from the school."],
                ["School wallet", "Every online collection credits a running school wallet balance that the school can see at any time."],
                ["Payouts", "The school requests a payout of the available balance; the request moves through Pending, Processing, Completed (or Failed) - with reason recorded if it fails."],
                ["Alerts", "Nominated school numbers receive an SMS whenever a payout is requested, and the request is also raised in-app."],
                ["Book payments", "Textbook payments made online follow the same secure path and are tracked per pupil."],
            ],
            widths=[2.1, 4.9],
            caption="Transparent treatment of online money - the school receives 100% of the fee it set.",
        ),
        callout("Cash is still first-class",
                "Many parents will keep paying at the office. Nothing about the online "
                "path forces a change in behaviour - cash, mobile money and bank "
                "transfers all record against the same pupil account, so the school "
                "always has one number to trust.",
                kind="info"),
    ]


def _module_books(cfg):
    return [
        h2("5.12  Textbook Management"),
        p("Textbooks are a significant cost, a frequent source of dispute and, in most "
          "schools, completely untracked. This module makes books a managed asset."),
        bullets([
            "Maintain a **book catalogue** with title, author, publisher, class, subject, price and cover image.",
            "Control **stock quantities** and see how many copies are allocated, available and unallocated.",
            "**Assign books to classes** - every pupil in the class inherits the assignment.",
            "**Assign books to individual pupils**, or opt a pupil out (for example if they already own a copy).",
            "Track each pupil's **book status**: assigned, paid, unpaid or returned.",
            "Record **book payments** in cash or online, with the same auditability as school fees.",
            "Produce a **book distribution list** per class for handing out and signing for books.",
            "Report on **outstanding book payments** alongside fee arrears, so follow-up happens once.",
        ]),
        callout("Books stop being a loss",
                "A catalogue plus per-pupil assignment turns an unmanaged cost into a "
                "tracked, recoverable asset - and gives the school an evidence trail if "
                "a book is disputed later.",
                kind="success"),
    ]


def _module_library_notes(cfg):
    return [
        h2("5.13  Digital Library & Lesson Notes"),
        p("Two related tools let the school distribute learning material and hold "
          "teachers to a documented scheme of work."),
        h3("Digital library"),
        bullets([
            "Upload materials with a **title, description and file** - PDFs, documents, slides or images.",
            "Tag each item to a **class and/or subject**, or leave it open to the whole school.",
            "Browse and search the library by class, subject or keyword.",
            "Materials are available to teachers and, where published, to pupils through the student portal.",
            "Perfect for past questions, revision packs, reading lists, syllabus documents and school policies.",
            "Replaces the photocopier queue and the WhatsApp group where files disappear.",
        ]),
        h3("Lesson notes"),
        bullets([
            "Teachers upload their **weekly lesson notes per class** directly into the platform.",
            "Notes carry the **title, file, uploader and upload date**, creating a permanent record.",
            "The head teacher can review that notes have been submitted, for which class and when.",
            "Historical notes build into a **searchable scheme-of-work archive** the school owns.",
            "New teachers inherit an organised bank of prior notes instead of starting from nothing.",
            "Provides objective evidence of curriculum coverage for GES inspection.",
        ]),
        callout("A quiet but powerful control",
                "Most schools have no reliable way to know whether lesson notes were "
                "prepared. With uploads time-stamped against a class, supervision "
                "becomes a matter of looking at a list, not chasing folders.",
                kind="info"),

        h2("5.14  Timetable"),
        bullets([
            "Build the **weekly timetable** across Monday to Friday with start and end times per period.",
            "Assign a **class and subject** to every slot, producing a complete class timetable.",
            "**Clash detection** - the platform prevents two subjects occupying the same class slot.",
            "**Auto-generation** help to seed a timetable quickly, then adjust by hand.",
            "**Per-class view** for printing and for posting on the classroom wall.",
            "**Per-teacher view**, so each teacher can see their week.",
            "The timetable is visible to **parents and pupils** in their portals, ending the daily 'what do we need tomorrow?' questions.",
        ]),
    ]


def _module_promotions(cfg):
    return [
        h2("5.15  Promotions"),
        p("End of year, every head teacher must decide who moves up, who repeats and who "
          "has left - and then move hundreds of pupil records without losing history. "
          "This module turns that from a weekend of spreadsheet surgery into a "
          "reviewed, reversible process."),
        bullets([
            "Create a **promotion batch** from one class to another (for example Basic 3 to Basic 4).",
            "The batch starts as a **draft** and is **finalised** only when the school is satisfied - nothing changes before that.",
            "Record a **per-pupil decision**: promote, repeat, or withdraw.",
            "Send an individual pupil to a **different target class** where needed, with a note explaining why.",
            "Support **partial promotion** of a class, leaving undecided cases to be resolved separately.",
            "Every decision is stored with **who made it and when**, giving a reviewable audit trail.",
            "Attendance, results and fee history **remain linked to the pupil**, not to the class - so nothing is lost when a pupil moves up.",
            "Withdrawals remove the pupil from active registers while preserving their complete record.",
        ]),
        callout("Safe by design",
                "Promotion is the single most destructive operation a school performs "
                "on its data. Here it is a draft that a human reviews and approves - not "
                "an irreversible bulk edit.",
                kind="success"),
    ]


def _module_comms(cfg):
    return [
        h2("5.16  Announcements, Events & Notifications"),
        p("Communication is where a school's reputation is built. This module makes "
          "sure the right people get the right message, and that there is a record "
          "that they were told."),
        h3("Announcements"),
        bullets([
            "Publish an announcement with **title and full content** to a chosen audience.",
            "**Target the audience precisely**: everyone, teachers only, parents only, or students only.",
            "Every announcement is **attributed to its author** and time-stamped.",
            "Announcements appear in the **parent portal dashboard**, so parents see them without being chased.",
            "Term dates, PTA meetings, examination schedules, fee deadlines and closures are all published in one trusted place.",
        ]),
        h3("School events calendar"),
        bullets([
            "Create events with **title, description, date and venue**.",
            "Maintain a shared school calendar used by staff, parents and pupils.",
            "Keep a historical calendar of what happened, when and where - useful for reporting.",
        ]),
        h3("Multi-channel notifications"),
        table(
            ["Channel", "Where it is used"],
            [
                ["In-app notifications", "A personal notification list inside the platform, with read/unread state, for each user."],
                ["SMS", "Sent through a Ghanaian SMS gateway to guardians' registered phone numbers - fee receipts, results released, leave decisions, payout alerts and reminders."],
                ["Mobile push", "Sent to the parent mobile app via the push service, so alerts arrive even when the app is closed."],
            ],
            widths=[1.8, 5.2],
        ),
        bullets([
            "Notifications are **targeted at the individual user**, so nobody receives another family's information.",
            "**Guardian contact numbers are validated** at entry, so alerts do not silently fail.",
            "The platform **keeps a record** of the notifications raised, giving the school evidence of communication.",
        ]),
        callout("The end of the WhatsApp broadcast",
                "Instead of one message to a group where half the parents are not "
                "members, the school sends a targeted message that arrives on the "
                "parent's phone and is also waiting in their portal.",
                kind="success"),

        h2("5.17  Certificates"),
        bullets([
            "Generate **completion, excellence, participation, character and custom certificates** on school letterhead.",
            "Certificates draw the **pupil's name, class, term, academic year and school branding** automatically from the system.",
            "Issue certificates **individually or for a whole class** at the end of a programme.",
            "Use custom text to record the specific achievement or reason for the award.",
            "Print-ready output that can be signed and presented - no re-typing of names ever again.",
        ]),
    ]


def _module_parent_portal(cfg):
    return [
        h2("5.18  Parent Portal"),
        p("This is the feature that most often decides whether a school keeps the "
          "system. Parents stop phoning the office for results, fees and term dates - "
          "everything is in their hand, on their phone, always current."),
        kv([
            ("Sign-in", "The parent signs in with the phone number the school already holds. No new email account to create."),
            ("Access model", "A parent sees only the children linked to their own registered phone number - never another family's data."),
            ("Second guardian", "A second guardian number can also be granted access, so both father and mother can follow the child."),
        ]),
        h3("What parents can do"),
        bullets([
            "**See each child's fee position** - total billed, total paid and balance for the current term, itemised by fee.",
            "**Pay fees online by mobile money** - settle the whole account or pay a specific item, with immediate confirmation.",
            "**Buy textbooks online** where the school has assigned them.",
            "**View attendance** - present and absent summary for the term.",
            "**View results and report cards** once the school releases them.",
            "**Check class position** where the school publishes ranking.",
            "**See the class timetable**, so the child arrives prepared.",
            "**Read school announcements** and the **events calendar**.",
            "**Receive SMS and push notifications** for receipts, results and important dates.",
        ]),
        callout("Role of the portal in fee collection",
                "Because the balance and the pay button sit side by side, the "
                "conversation with a parent changes from 'please come to the office' "
                "to 'the balance is on your portal, you can pay now'.",
                kind="success"),

        h2("5.19  Student Portal"),
        p("Pupils get their own secure sign-in, separate from staff and parents, so "
          "they can take part in online learning without any access to school records."),
        bullets([
            "A personal **dashboard** showing the pupil's class and recent activity.",
            "**Available online examinations**, with start and end windows enforced by the platform.",
            "**Take a computer-based test** in the browser within the allotted duration, with answers saved as the pupil progresses.",
            "**Scores appear only after the school releases the results** - never before, and never to another pupil.",
            "**Review past attempts**, including score and total marks, once released.",
            "Access to **published learning materials**, timetables and announcements for their class.",
            "A pupil can only ever see **their own** work.",
        ]),
    ]


def _module_reports(cfg):
    return [
        h2("5.20  Reports & Analytics"),
        p("A head teacher needs one screen that answers: how many pupils do we have, "
          "how many came to school today, how much money came in this month, and what "
          "is outstanding. That screen is the reports dashboard."),
        h3("School overview dashboard"),
        table(
            ["Indicator", "What it tells the head teacher"],
            [
                ["Enrolment", "Total pupils, active pupils, pupils enrolled this month and pupils no longer active."],
                ["Staffing", "Total teachers, active teachers and inactive teacher accounts."],
                ["Attendance today", "Present, absent, late and excused counts for the current day."],
                ["Attendance trend", "The week's attendance pattern, so a slide becomes visible before it becomes a problem."],
                ["Fees collected", "Amount collected in the month and for the term to date."],
                ["Outstanding fees", "Count of pupils with unpaid, part-paid or half-paid positions."],
                ["Recent payments", "The latest payments recorded, so the desk is reconciled to the moment."],
                ["Upcoming events", "What is coming up on the school calendar."],
            ],
            widths=[1.9, 5.1],
            caption="Everything on the dashboard updates live from the same records staff already maintain.",
        ),
        h3("Class and pupil level"),
        bullets([
            "**Class-by-class breakdown** of enrolment, attendance and fee collection.",
            "**Subject performance analysis** across assessments and terms.",
            "**Class ranking** computed automatically from term results.",
            "**Individual pupil progress** across terms, drawn from recorded assessment and examination scores.",
            "**Fee collection rate** per class, per term and per year - the number the bursar is judged on.",
            "**Defaulter and arrears reports** with guardian contact details.",
            "**Report cards** generated from the school's results, ready to print or release to parents.",
        ]),
        callout("Data the school already has, working harder",
                "Because attendance, results and payments all live in one database, "
                "the school gets cross-cutting insight - for example a class with low "
                "attendance and poor fee collection - that separate registers can never "
                "reveal.",
                kind="info"),

        h2("5.21  School Settings & Branding"),
        bullets([
            "**School identity** - name, abbreviation, motto, address, region and district, phone and email.",
            "**Logo and branding** carried into the interface, report cards and certificates.",
            "**Academic structure** - class levels from Creche and Nursery through KG to Basic 1-9 / JHS, with sections.",
            "**Academic terms** with start and end dates, and one marked as the **current term**.",
            "**Subjects** configured per class level and assigned to the teachers who teach them.",
            "**Grading scheme** - the school's own grade boundaries and remarks used on report cards.",
            "**User accounts and permissions** - create staff accounts and control exactly what each role may see and do.",
            "**Payment configuration** - the school's collection account details for online payments.",
            "**Messaging configuration** - school name used as the SMS sender identity and the numbers that receive alert messages.",
        ]),
        callout("Built to be handed over",
                "School identity, grading, terms and staff accounts are all configurable "
                "by the school itself. The school is never locked into a vendor to "
                "change its own name, its own term dates or its own grading.",
                kind="success"),
    ]


def _roles_and_access(cfg):
    return [
        h1("6. Roles, Access & the Permission Model"),
        p("Access is built on **four clearly separated roles**. Each role sees exactly "
          "what its job requires - and nothing else. There is no general 'staff' "
          "account that can wander anywhere in the system."),
        table(
            ["Role", "Who it is for", "What it is for"],
            [
                ["School Administrator", "Head teacher, proprietor, administrator, bursar, office staff", "Full control of the school: pupils, staff, classes, attendance, results, fees, books, promotions, communications, reports and settings."],
                ["Teacher", "Class teachers and subject teachers", "Teaching duties only: their class register, their subject scores, lesson notes, timetables and their own leave requests."],
                ["Parent", "Mothers, fathers and guardians", "Read-only portal access to their own children - fees, attendance, results, timetable and announcements, plus online payment."],
                ["Student", "Pupils in the school", "A separate pupil portal for online examinations, learning materials, timetable and their own released scores."],
            ],
            widths=[1.5, 2.2, 3.3],
        ),
        h3("Capability matrix"),
        table(
            ["Capability", "Admin", "Teacher", "Parent", "Student"],
            [
                ["Manage pupil records", "Full", "Own class (view)", "Own children (view)", "-"],
                ["Mark attendance", "Full", "Own class", "Own child (view)", "-"],
                ["Enter assessment & exam scores", "Full", "Own subjects", "-", "-"],
                ["View results / report cards", "Full", "Own subjects & class", "Own child (when released)", "Own scores (when released)"],
                ["Fee structures & payments", "Full", "-", "Own child - view & pay", "-"],
                ["Timetable", "Manage", "View", "Own child's class", "Own class"],
                ["Announcements & events", "Publish", "Read", "Read", "Read"],
                ["Leave / permission requests", "Approve or reject", "Submit", "-", "-"],
                ["Digital library", "Manage", "Upload & read", "-", "Published items"],
                ["Lesson notes", "Review all", "Upload own", "-", "-"],
                ["Books (textbooks)", "Manage all", "View assigned", "Own child - view & pay", "-"],
                ["Online examinations (CBT)", "Create, publish, release results", "-", "-", "Take exam"],
                ["Promotions", "Create & finalise", "-", "-", "-"],
                ["Reports & analytics", "Whole school", "Own class", "-", "-"],
                ["School settings & branding", "Full", "-", "-", "-"],
            ],
            widths=[1.9, 1.4, 1.4, 1.3, 1.0],
            caption="A single, defensible access model - every role's reach is documented.",
        ),
        h3("How sign-in works"),
        bullets([
            "**Staff sign in with a phone number and password** - the format Ghanaian staff already use daily. Passwords are stored only as salted hashes, never as readable text.",
            "The platform issues a **secure session token** with a **refresh token**, so users stay signed in without weakening security.",
            "New accounts are flagged to **change password on first sign-in**, so no default password stays in circulation.",
            "Accounts can be **deactivated** rather than deleted - a teacher who leaves loses access instantly while the record is preserved.",
            "Teachers are onboarded by **invitation**: the school creates the staff record, the teacher receives a **staff ID, a one-time code and an SMS invitation**, and sets their own password.",
            "**Parents need no account creation**: access is granted by the guardian phone numbers already recorded against the pupil - including a **second guardian** number.",
            "**Pupils sign in to the student portal with their Student ID and a PIN** (issued by the school, and which the pupil is required to change on first use). That portal never exposes staff or administrative screens.",
        ]),
        h3("Built-in staff accountability"),
        bullets([
            "**Automatic teacher check-in** is recorded when a teacher signs in, giving an objective staff attendance record.",
            "**Leave and permission requests** (sick, personal, maternity, paternity, study or other) are submitted in-app and move through Pending, Approved or Rejected.",
            "The teacher is notified of the decision **by SMS**, and the decision history is retained with the reason given.",
        ]),
        callout("Why this matters to a school board",
                "Fee data, pupils' medical notes and staff records are sensitive. A "
                "documented four-role model, enforced by the system rather than by "
                "trust, is what a board needs to see before approving rollout.",
                kind="info"),
        pagebreak(),
    ]


def _feature_register(cfg):
    return [
        h1("7. Complete Feature Register"),
        p("This is the consolidated register of what the platform does, mapped to the "
          "day-to-day need it answers. It is intended to be used as a **checklist "
          "during evaluation** - a school can tick each line against its own "
          "requirements."),
        table(
            ["The school's need", "How DEACONS SMS answers it", "Section"],
            [
                ["Know every pupil in one place", "Pupil records with photo, health insurance card, guardians, class and admission history", "5.2"],
                ["Never lose a pupil's history", "Records stay linked to the pupil through class changes, promotions and repeats", "5.15"],
                ["Know who is in school today", "Attendance marked per class with present, absent, late and excused states", "5.7"],
                ["Tell a parent the same day", "Automatic SMS to the guardian when a pupil is absent", "5.7 / 5.16"],
                ["Produce report cards fast", "Scores entered once; grades, totals, subject positions and class ranking computed", "5.9"],
                ["Assess continuously", "Class assessments (tests, homework, classwork, projects) plus end-of-term exams", "5.9"],
                ["Collect fees on time", "Fee structures per class and term, live status, receipts, defaulters", "5.11"],
                ["Let parents pay without cash", "Mobile money payment from the parent portal, credited straight to the school", "5.11"],
                ["Track textbooks", "Book catalogue, per-pupil assignment and book payments", "5.12"],
                ["Control what teachers teach", "Weekly lesson notes uploaded per class and reviewable by the head", "5.13"],
                ["Distribute learning material", "Digital library tagged by class and subject", "5.13"],
                ["Build a timetable without clashes", "Weekly timetable with class and teacher views", "5.14"],
                ["Run end-of-year promotion safely", "Draft promotion batches with per-pupil decisions and an audit trail", "5.15"],
                ["Communicate reliably", "Targeted announcements plus SMS, push and in-app notifications", "5.16"],
                ["Recognise achievement", "Certificates generated from live pupil data on school branding", "5.17"],
                ["Answer parents without phone calls", "Parent portal: fees, attendance, results, timetable, announcements", "5.18"],
                ["Deliver online learning", "Computer-based tests with release control over results", "5.19 / 5.10"],
                ["See the whole school at once", "Dashboard: enrolment, attendance, collection, outstanding fees, events", "5.20"],
                ["Make it the school's system", "School identity, branding, terms, subjects, grading and staff accounts", "5.21"],
                ["Control who sees what", "Four-role access model enforced by the platform", "6"],
                ["Load an existing school quickly", "Bulk pupil and teacher import from a single spreadsheet file", "12"],
            ],
            widths=[1.9, 4.1, 0.8],
            caption="Twenty-one everyday school needs, each answered by a documented capability.",
        ),
        pagebreak(),
    ]


def _technical_architecture(cfg):
    return [
        h1("8. Technical Architecture, Security & Data Protection"),
        lead("A school board approving a platform is really approving three things: "
             "where the data lives, who can reach it, and what happens if something "
             "goes wrong. This section answers all three plainly, without jargon."),

        h2("8.1  How the platform is delivered"),
        p("There is nothing for the school to install. %s runs as a hosted web "
          "service, reached through a browser on any device." % cfg["product"]),
        table(
            ["Aspect", "How it works"],
            [
                ["Deployment model", "One private instance per school - the school's own application and its own database. Nothing is shared with any other school."],
                ["Web address", "A dedicated HTTPS address for the school (optionally on a school-owned domain)."],
                ["Encryption in transit", "All traffic is served over HTTPS with a TLS certificate; there is no plain HTTP access to the platform."],
                ["Devices", "Any modern browser - Android phone, iPhone, tablet, laptop or desktop. No app installation required for staff."],
                ["Bandwidth", "Pages are server-rendered and light, so the platform is usable on modest connections and entry-level devices."],
                ["Uptime", "The service is monitored, and the school is notified in advance of any planned maintenance."],
                ["Data location", "Hosted on reputable cloud infrastructure with managed PostgreSQL, in a region chosen for latency to Ghana."],
            ],
            widths=[1.9, 5.1],
            caption="Delivery model in one view - hosted, isolated and browser-based.",
        ),

        h2("8.2  Where the school's data lives"),
        bullets([
            "All records - pupils, guardians, staff, attendance, assessments, results, fees, payments and documents - live in a single **PostgreSQL** database, the same class of database used by banks and hospitals.",
            "The school's database is **dedicated to that school**. There is no shared table in which another school's data could be exposed by a query mistake.",
            "The **schema is version-controlled**. Every structural change is a reviewed migration, so the database cannot drift into an undocumented state.",
            "Uploaded files (passport photos, lesson notes, book covers, library materials) are stored on the school's own instance storage, with **file-type and file-size limits enforced on upload**.",
            "The platform **never stores card numbers or mobile-money credentials** - the parent approves payment on the mobile-money provider's own secure page.",
        ]),
        callout("Why single-tenant matters to a school",
                "In a shared system, a single coding error can expose one school's "
                "pupils or fee records to another school. Segregating each school "
                "into its own instance and its own database removes that class of "
                "risk entirely - and makes it simple to hand the school a complete "
                "copy of its own data.",
                kind="info"),
    ]


        h2("8.3  Security controls built into the platform"),
        table(
            ["Control", "What it means in practice"],
            [
                ["Password protection", "Passwords are never stored as text. They are held only as salted, one-way hashes, so even direct database access does not reveal a password."],
                ["Secure sessions", "Sign-in issues a short-lived access token plus a refresh token, so users are not repeatedly logged out - without weakening session security."],
                ["Token verification on every request", "Every protected API call verifies the token's signature and role before any data is returned."],
                ["First-login password change", "Newly created staff accounts are flagged to change password at first sign-in, so no default password stays in circulation."],
                ["Server-side role enforcement", "Permissions are enforced in the back end, not merely hidden in the interface. A parent or teacher cannot reach administrative data by guessing a web address."],
                ["Immediate deactivation", "Leavers are deactivated rather than deleted - access ends the moment a person leaves, while the historical record is preserved."],
                ["One-time invitation codes", "Staff are onboarded through an invitation carrying a **time-limited one-time code** delivered by SMS; the code expires if unused."],
                ["Time-limited OTPs", "Password-reset codes expire after a short window, and repeated failed attempts are counted against the code."],
                ["Self-service password reset", "Reset runs through an SMS one-time code sent to the user's own registered number - not through an email that could be intercepted."],
                ["Input validation", "Every API input is validated and normalised before it reaches the database, blocking malformed or malicious payloads."],
                ["Strict origin allow-list", "The API only answers requests from the platform's own approved web addresses, so a copied page cannot silently talk to the school's data."],
                ["Ghana phone-number validation", "Phone numbers are validated and normalised, so alerts always reach correctly formatted numbers."],
                ["Upload limits", "File uploads are restricted by type and size, preventing oversized or unexpected files from entering the system."],
                ["Sensitive-value handling", "Provider credentials and keys are held in server-side configuration, never in the browser or in the school's visible documents."],
                ["Least privilege by design", "Each role is granted only the endpoints its job requires, with no general-purpose 'staff' account."],
            ],
            widths=[1.9, 5.1],
            caption="Security is enforced in the back end - not left to trust or to staff discipline.",
        ),
        pagebreak(),
    ]


        h2("8.4  Backups, availability & disaster recovery"),
        p("Data loss is the risk a school feels most keenly, because pupils' "
          "academic history cannot be re-typed. Our commitments here are deliberate "
          "and are set out in the service agreement:"),
        table(
            ["Commitment", "Detail"],
            [
                ["Automated backups", "The school's database is backed up automatically **every day**, retained on a rolling basis, and stored separately from the live database."],
                ["Restore testing", "Backups are restored into a test environment at least once a term, so recovery is a rehearsed procedure - not a hope."],
                ["Accidental deletion protection", "Deleting a class or a record in the interface does not silently remove history; records are deactivated or superseded so the audit trail survives."],
                ["Recovery target", "In the event of a serious incident, our target is to restore the school's data to within the previous day's backup, within one working day of the incident being confirmed."],
                ["Planned maintenance", "Any maintenance that interrupts service is scheduled outside school hours and notified in advance."],
                ["Monitoring", "The service is monitored for availability and error rates, so problems are usually found before the school reports them."],
            ],
            widths=[1.8, 5.2],
            caption="Availability and recovery commitments - stated so the school can hold us to them.",
        ),

        h2("8.5  Data protection & privacy"),
        p("The platform processes personal data about children, staff and parents. "
          "That brings obligations, and the platform is designed to make them easy "
          "for the school to meet under Ghana's data protection law (the Data "
          "Protection Act, 2012 - Act 843)."),
        table(
            ["Principle", "How the platform supports it"],
            [
                ["Lawful, defined purpose", "Data is held to run the school: enrolment, attendance, assessment, results, fees, communication and statutory reporting. Nothing is collected for advertising."],
                ["Data minimisation", "Fields are structured and purposeful - the platform does not require a pupil's national ID, biometrics or bank details."],
                ["Accuracy", "Records are edited in one place and immediately correct everywhere, so reports are never built on stale copies."],
                ["Access limitation", "Only the four defined roles reach the data, and each is limited to what their function requires."],
                ["Security safeguards", "Hashed passwords, token-based sessions, encrypted transport, validated input and daily backups."],
                ["Retention & deletion", "The school decides how long records are kept. On request, data can be exported in full and then deleted in line with the school's retention policy."],
                ["Data subject rights", "Requests by a parent or member of staff to see or correct their own data can be answered directly from the platform's records."],
                ["Children's data", "Pupil photographs and health information are visible only to authorised staff and the pupil's own guardian - never published or shared."],
                ["Third-party sharing", "Data is shared only with the SMS and payment providers needed to deliver a service the school has asked for, and only the minimum needed."],
                ["No selling of data", "The school's data is never sold, rented or used for any purpose beyond operating the school's platform."],
            ],
            widths=[1.9, 5.1],
            caption="Privacy by design rather than privacy by promise.",
        ),
        pagebreak(),
    ]


        h2("8.6  How online payments are handled safely"),
        p("Money is the area where trust is won or lost, so the flow is deliberately "
          "narrow and fully recorded."),
        numbered([
            "The parent initiates payment **from inside their own portal**, for a specific pupil and a specific set of fee lines - there is no free-form amount field.",
            "The platform creates a **payment intent** recording the amount charged to the parent, the amount due to the school and the platform fee, all before any money moves.",
            "Checkout is completed **on the mobile-money provider's own secure page**; the school's platform never sees the parent's mobile-money PIN.",
            "The provider confirms the result back to the platform through a **cryptographically signed callback**, which the platform verifies before acting on it.",
            "On confirmation the payment is written against the pupil's fee lines, the fee status recalculates, the **school wallet is credited** and receipts are available.",
            "Every intent keeps its own status history (**pending, successful, failed**), so a disputed payment can be traced end to end.",
        ]),
        table(
            ["Safeguard", "Why it matters"],
            [
                ["No card or wallet credentials stored", "There is nothing of the parent's to leak, because the platform never holds it."],
                ["Payment intents recorded before settlement", "The platform's expected position always exists in writing, so a missing callback can be reconciled - not guessed at."],
                ["Signed provider callbacks", "A third party cannot fabricate a 'payment successful' message to the platform."],
                ["Gross and net recorded separately", "The parent's charge, the school's entitlement and the platform fee are stored as separate figures - so the school's money is always identifiable."],
                ["Targeted settlement", "A parent paying one item settles that item first, ending the 'I paid, but the balance did not move' argument."],
                ["Wallet and payout trail", "Payout requests are raised by a named user and carry status, amount, note, processor reference and failure reason."],
                ["Management alerting", "Nominated school numbers receive an SMS each time a payout is requested - an independent check on money leaving the wallet."],
                ["Office cash path preserved", "Front-desk cash, bank and mobile-money payments are still recorded with receipt numbers, so no channel is unaccounted for."],
            ],
            widths=[2.0, 5.0],
            caption="The payment trail is designed so every cedi can be explained after the fact.",
        ),

        h2("8.7  Messaging architecture (SMS, in-app and push)"),
        bullets([
            "**SMS is sent through a Ghanaian gateway** - Hubtel by default, with Arkesel available as an alternative - using a school-configured **sender ID** so messages are recognisable and not treated as spam.",
            "The gateway is a **configurable component**, not hard-wired: if the school prefers a different provider, or a provider's reliability changes, the platform can be switched without rebuilding anything.",
            "Messages are triggered by events - absence, released results, fee confirmation, invitations, leave decisions, announcements and payouts - rather than sent by hand.",
            "**In-app notifications** appear inside the platform for staff, so a user who is already signed in does not need an SMS.",
            "**Push notifications** reach parents inside the companion mobile app via a registered device token.",
            "The platform **normalises Ghanaian phone numbers** at entry, so a number typed as 024..., +23324... or 23324... all resolve to the same guardian and alerts do not silently fail.",
            "**Message volume is agreed up front**: the school chooses which events trigger an SMS, so the alerting budget stays predictable rather than being driven by the platform.",
        ]),
        callout("Keep the school's number as the sender",
                "Messages shown to parents carry the school's own sender ID rather than "
                "an unfamiliar short code. Parents recognise the school, open the "
                "message, and act on it - which is the entire point of the alert.",
                kind="info"),
        pagebreak(),
    ]


        h2("8.8  What happens if something goes wrong"),
        p("A credible supplier states its incident process in advance. Ours is "
          "simple and short:"),
        numbered([
            "**Detection** - either our monitoring alerts us, or the school reports the issue through the support channel.",
            "**Acknowledgement** - the school receives a response within the response time for the severity of the issue (see the support section).",
            "**Containment** - we establish whether data is at risk, stop any worsening, and tell the school what we know so far.",
            "**Resolution and restoration** - the fault is corrected, and data is restored from backup if anything was lost.",
            "**Written summary** - the school receives a plain-English account of what happened, what has changed, and what prevents a repeat.",
            "**Notification of the school's obligation** - where an incident involves personal data, we tell the school promptly and in plain terms so that the school can meet its own notification duties.",
        ]),
        callout("One thing to ask us at any time",
                "A board is entitled to ask, at any point in the relationship: "
                "'Show us that our data can be exported and restored.' Our answer "
                "is a live demonstration, not a paragraph in a proposal.",
                kind="success"),
        pagebreak(),
    ]


def _implementation(cfg):
    return [
        h1("9. Implementation & Onboarding Plan"),
        lead("Implementation is the part most school software projects get wrong. "
             "Because %s is hosted, there is nothing to install - so our plan "
             "concentrates entirely on the three things that actually decide "
             "success: correct configuration, clean data, and trained people."
             % cfg["product"]),

        h2("9.1  What implementation actually involves"),
        table(
            ["Workstream", "What it means", "Who leads"],
            [
                ["Configuration", "School identity, branding, class levels and sections, subjects, terms, grading scheme and user accounts are set up to match how the school already runs.", "We do it, the school approves"],
                ["Data load", "Pupils, guardians and teachers are loaded from the school's existing records using our standard spreadsheet templates.", "Joint - school supplies, we import"],
                ["Verification", "The school checks a printed or on-screen class list against reality before go-live, so errors are found now and not in term two.", "The school leads"],
                ["Training", "Role-based sessions for administrators, teachers and office staff, plus short guidance for parents.", "We deliver"],
                ["Go-live", "The system becomes the school's live system on an agreed date, with first-week support on standby.", "Joint"],
                ["Review", "A structured review at the end of the first term to tune configuration against how the school actually works.", "Joint"],
            ],
            widths=[1.4, 4.1, 1.5],
            caption="Six workstreams. Nothing here requires the school to buy hardware or software.",
        ),

        h2("9.2  Typical timeline"),
        p("The plan below is the standard four-week path for a school of up to "
          "roughly 600 pupils. Larger schools, or schools loading several years of "
          "history, take longer on the data workstream only."),
        table(
            ["Phase", "When", "What happens", "Outcome"],
            [
                ["1. Kick-off", "Day 1 (one hour)", "Management meeting confirms scope, go-live date, the staff champion and the data the school will supply.", "Agreed plan and named contacts on both sides."],
                ["2. Configuration", "Days 2-7", "School identity, branding, classes, sections, subjects, terms, grading, fee structures and staff accounts are configured.", "A system that looks and behaves like the school."],
                ["3. Data preparation", "Days 5-12", "The school completes the pupil, guardian and teacher templates; we validate them and resolve gaps with the office.", "One clean, agreed opening class list."],
                ["4. Data load & verification", "Days 12-16", "Data is imported, class rolls and fee structures are checked, and the school signs off the opening position.", "Numbers the school recognises as its own."],
                ["5. Training", "Days 16-21", f"Role-based sessions for administrators and office staff, class teachers and subject teachers (up to {cfg['training_sessions_included']} sessions included).", "Staff who can work unaided."],
                ["6. Go-live", "Day 21 onwards", "Attendance, results and fee recording move onto the platform, with hands-on support during the first week.", "The platform becomes the school's system of record."],
                ["7. Review & tune", "End of first term", "Review of usage, report quality and collection performance; configuration adjusted; training gaps re-covered.", "A platform shaped to the school, and a value report for the board."],
            ],
            widths=[1.3, 1.2, 3.1, 1.6],
            caption="A four-week path from signed agreement to a live system, then a first-term review.",
        ),
        pagebreak(),
    ]


        h2("9.3  Who does what"),
        table(
            ["Task", "The school", "DEACONS"],
            [
                ["Nominate a staff champion", "Provides", "Supports"],
                ["Confirm scope and go-live date", "Decides", "Proposes"],
                ["Supply pupil, guardian and teacher data", "Provides", "Supplies the templates and checks the data"],
                ["Configure classes, subjects, terms, grading", "Approves", "Delivers"],
                ["Configure fee structures and amounts", "Decides", "Delivers"],
                ["Verify the opening class list", "Leads", "Assists"],
                ["Set the SMS alerting rules", "Decides", "Delivers"],
                ["Attend training", "Provides the people", "Delivers the training"],
                ["Communicate with parents", "Leads", "Supplies the message and parent guidance"],
                ["Day-one and first-week support", "Reports issues", "On standby"],
                ["First-term review", "Participates", "Leads"],
            ],
            widths=[3.0, 2.0, 2.0],
            caption="Clear ownership prevents the most common cause of a stalled rollout: nobody knowing whose job a task is.",
        ),

        h2("9.4  Go-live readiness checklist"),
        p("We will not push a school live until every line below is confirmed. This "
          "checklist is shared with the school and ticked jointly."),
        bullets([
            "**Classes and sections** match the school exactly - including any split sections such as Basic 4A and 4B.",
            "**Subjects** are set up per class level and assigned to the right teachers.",
            "**Terms** are created with correct start and end dates, and one is marked current.",
            "**Pupils** are loaded, counted and verified against the school's own roll.",
            "**Guardian phone numbers** are present for every pupil - this is what makes attendance alerts and fee reminders work.",
            "**Fee structures** for the term are correct, including optional items such as feeding, transport or PTA levies.",
            "**Grading scheme** matches the school's report-card convention.",
            "**Staff accounts** exist for every teacher and office user, with roles assigned correctly.",
            "**Administrators and teachers** have completed training, and each has signed in at least once.",
            "**SMS sender ID** is approved and a live test message has been received by the school.",
            "**Report card template** has been produced once as a sample and approved by the head teacher.",
            "**Parent guidance** (one page, plain language) is ready to be sent home.",
        ]),

        h2("9.5  What we watch in the first term"),
        bullets([
            "**Attendance completion rate** - is every class actually being marked, every day?",
            "**Score entry timeliness** - are assessments being entered as they happen, or piling up?",
            "**Fee collection rate** - is the collection rate improving against the school's previous term?",
            "**Parent portal activity** - are parents actually using it, or is the school still answering the same question by phone?",
            "**SMS delivery** - are alerts reaching guardians, and are the right numbers recorded?",
            "**Support tickets** - what are staff asking for, and does it point to a training gap or a configuration gap?",
        ]),
        p("Findings from these six checks drive the first-term review, and any "
          "configuration change is made with the school rather than to the school."),

        h2("9.6  What could slow the rollout - and how we handle it"),
        table(
            ["Potential obstacle", "Our mitigation"],
            [
                ["The school's pupil data is only on paper or scattered across files.", "We supply a simple spreadsheet template and work through it with the office; partial data can be loaded and completed after go-live without disrupting live records."],
                ["Guardian phone numbers are missing or out of date.", "We flag missing numbers during validation and generate a short letter or SMS script the school can use to collect them from parents."],
                ["Term is already in progress.", "We go live from the current point and enter opening balances for fees, so no history is invented and no money is mis-stated."],
                ["Staff resistance or low confidence.", "Training is role-based and practical; the staff champion is equipped to re-show colleagues, and we remain reachable during the first weeks."],
                ["Internet connectivity at the school is unreliable.", "The platform is light and mobile-friendly; marking can be done from a phone, and office work can be completed when the connection is available."],
                ["A change of leadership or priorities mid-rollout.", "The staff champion and the management decision are documented at kick-off, so the rollout does not depend on one individual's memory."],
            ],
            widths=[2.6, 4.4],
            caption="Named risks with a planned response - because a rollout with no risks identified is a rollout that has not been thought through.",
        ),
        pagebreak(),
    ]


def _training(cfg):
    return [
        h1("10. Training & Capacity Building"),
        lead("Training is the difference between a system the school owns and a "
             "system the school resents. Our approach is deliberately narrow: teach "
             "each person the tasks their role actually performs, on the school's own "
             "data, and leave behind material they can use without us."),

        h2("10.1  How we train"),
        bullets([
            "**Role-based, not feature-based.** A class teacher is never shown the bursar's screens, and the bursar is never made to sit through lesson notes.",
            "**Hands-on and practical.** Every session uses the school's own classes, subjects and pupils - not a demo school - so what staff learn is what they will do tomorrow.",
            "**Short sessions over long workshops.** Teachers' time is precious; sessions are kept tight and scheduled around the school's timetable.",
            "**A staff champion is trained first**, then equipped to re-show colleagues - so the school has an internal expert from the start.",
            "**A sample is produced in training.** By the end of each session the group has produced a real artefact: a marked register, a captured score set, a printed report card or a recorded payment.",
        ]),

        h2("10.2  Training curriculum by role"),
        table(
            ["Audience", "What they learn", "Duration"],
            [
                ["Administrators & office staff",
                 "Signing in and managing users; pupils and guardians; classes, subjects and terms; attendance oversight; assessments and results; fee structures and payment recording; fee status and defaulter lists; books; announcements; reports; settings and branding.",
                 "Two sessions (about 2 hours each)"],
                ["Class teachers",
                 "Signing in; their class roll; daily attendance marking and absence alerts; class assessments and score entry; viewing results and report cards for their class; uploading lesson notes; their timetable.",
                 "One session (about 2 hours)"],
                ["Subject teachers",
                 "Signing in; their subject classes; entering subject scores; reviewing subject performance; lesson notes and materials; their timetable.",
                 "One session (about 1.5 hours)"],
                ["Head teacher / proprietor",
                 "School-wide dashboards and analytics; fee collection position; staff check-in and leave approvals; report-card approval; promotion decisions; auditing what has and has not been done.",
                 "One session (about 1.5 hours)"],
                ["Parents",
                 "How to reach the portal with the guardian phone number; what they can see; paying by mobile money; reading a report card. Delivered as a one-page guide plus an optional short session at a PTA meeting.",
                 "One-page guide + optional PTA slot"],
                ["Pupils",
                 "Signing into the student portal with their Student ID; changing their PIN; sitting an online test; viewing released results.",
                 "Short class briefing, delivered by the school with our briefing sheet"],
            ],
            widths=[1.6, 4.6, 1.0],
            caption="Every role learns its own work. Nothing more, nothing less.",
        ),
        pagebreak(),
    ]


        h2("10.3  Materials the school keeps"),
        bullets([
            "A **one-page quick guide per role** - laminated for the staff room, showing the five or six tasks that role performs.",
            "A **one-page parent guide** in plain language, ready to photocopy or send home.",
            "A **student portal briefing sheet** for class briefings.",
            "A **data template pack** (pupil, guardian and teacher spreadsheets) with an example row for each field, so future intakes can be prepared by the school itself.",
            "A **staff-champion pack** so a new champion can be trained up internally if the original leaves.",
        ]),
        callout("Materials belong to the school",
                "Every guide, template and briefing sheet we produce is handed to the "
                "school without restriction. If the school ever stops working with us, "
                "it keeps the knowledge, not just the data.",
                kind="success"),

        h2("10.4  Ongoing enablement, not one-off training"),
        table(
            ["When", "What happens"],
            [
                ["Start of each term", "A short refresher slot for new staff and anyone who needs to re-cover a workflow, plus a note of anything that has changed in the platform."],
                ["When a new staff member joins", "The school's existing materials and in-app guidance are enough for a competent user; we provide a catch-up session if the school wants one."],
                ["When a new feature is released", "A short, plain-language note explaining what has changed and what (if anything) the school must do - never a silent change to a live system."],
                ["End of first term", "A review that doubles as training: gaps identified in the review are re-covered with the staff concerned."],
                ["On request", "Additional or refresher training sessions, quoted separately and normally delivered remotely."],
            ],
            widths=[1.8, 5.2],
            caption="Training is an ongoing habit, not an event that happened once at go-live.",
        ),

        h2("10.5  How we know training worked"),
        table(
            ["Signal", "What good looks like"],
            [
                ["Everyone has signed in", "Every staff account issued has been used at least once, and each user has set their own password."],
                ["Registers are complete", "Attendance is marked on a normal school day without prompting from management."],
                ["Scores are timely", "Assessments are entered as they are marked, rather than reconstructed at the end of term."],
                ["Payments are recorded the same day", "Office receipts appear in the platform within a day of the cash or transfer being received."],
                ["Report cards come out fast", "The first report card run takes the school hours, not weeks."],
                ["Support tickets fall", "The volume and nature of support requests trends down and away from basic 'how do I' questions."],
                ["Parents self-serve", "Parents are checking fees and results themselves instead of calling the office."],
            ],
            widths=[2.0, 5.0],
            caption="Adoption is measured by behaviour, not by attendance at a workshop.",
        ),
        pagebreak(),
    ]


def _support(cfg):
    return [
        h1("11. Support & Service Levels"),
        lead("Support is where a supplier's real character shows. This section sets "
             "out exactly how the school reaches us, how quickly we commit to "
             "responding, and what the school can hold us to."),

        h2("11.1  How the school reaches us"),
        table(
            ["Channel", "Best used for", "Availability"],
            [
                ["Phone call / WhatsApp", "Anything urgent - the school cannot mark attendance, cannot produce a report card, or a payment is not appearing.", "Working days, 7:00am - 7:00pm (extended on go-live days and report-card weeks)"],
                ["Email", "Non-urgent issues, requests to change configuration, questions with attachments (screenshots, spreadsheets).", "Monitored on working days; answered within one working day"],
                ["In-platform issue channel", "Reporting a problem with enough context that we can find it quickly.", "Monitored on working days"],
                ["Scheduled review call", "Forward planning - end-of-term reports, promotions, next term's setup, new requirements.", "Monthly or termly, as the school prefers"],
                ["On-site visit", "Training, first report-card run, or a major change such as promotions or migration of historical results.", "By arrangement, Accra and surrounds"],
            ],
            widths=[1.6, 3.9, 1.5],
            caption="One number, one email, one place in the platform - no ticket ping-pong.",
        ),

        h2("11.2  What counts as urgent - and our response commitments"),
        table(
            ["Level", "Description", "Examples", "First response", "Target resolution"],
            [
                ["P1 - Critical",
                 "The school cannot operate, or money or data is at risk.",
                 "Cannot sign in at all; fees or payments not recording; report cards impossible to produce during reporting week; suspected data exposure.",
                 "Within 1 hour (during support hours)",
                 "Same working day, with a workaround offered immediately where possible"],
                ["P2 - High",
                 "A core daily task is broken, but the school is still running.",
                 "Attendance saving incorrectly; SMS alerts not sending; a class or subject missing from the roll; results not calculating.",
                 "Within 4 hours",
                 "Within 2 working days"],
                ["P3 - Medium",
                 "A feature or report does not behave as expected, or a configuration change is needed.",
                 "A report total is questioned; a new fee structure or subject is required; a staff account needs changing.",
                 "Within 1 working day",
                 "Within 5 working days"],
                ["P4 - Low",
                 "Questions, guidance, cosmetic issues and requests for future features.",
                 "'How do I...'; wording tweaks; suggestions for improvements.",
                 "Within 2 working days",
                 "Agreed with the school; feature suggestions enter the product backlog"],
            ],
            widths=[1.2, 1.6, 2.4, 0.9, 1.3],
            caption="Severity is agreed by impact on the school - not by how loudly it is reported.",
        ),
        callout("Our position on critical issues",
                "A P1 issue in term time gets priority over everything else we are "
                "working on. If a critical issue cannot be fixed within the target, "
                "we tell the school plainly what is happening, provide a workaround "
                "so the school day continues, and keep the school updated until it is "
                "closed.",
                kind="warn"),
        pagebreak(),
    ]


        h2("11.3  Escalation"),
        p("If the school is not satisfied with progress at any point, there is a "
          "named path upward - no ambiguity about who to chase."),
        table(
            ["Step", "Who", "When it applies"],
            [
                ["1", "Support desk", "Every issue starts here."],
                ["2", "Partnerships Lead", "The issue is unresolved past its target, or a P1 is in progress."],
                ["3", "Technical Lead", "The issue requires an engineering decision or a production fix."],
                ["4", "Management", "A commercial, contractual or repeated service concern."],
            ],
            widths=[0.7, 2.2, 4.1],
            caption="Escalation is automatic at each threshold - the school does not have to ask for it.",
        ),

        h2("11.4  What is included, and what is quoted separately"),
        table(
            ["Included in the term licence", "Quoted separately"],
            [
                ["Unlimited support requests during support hours, across all roles", "On-site visits outside Accra, including travel and accommodation"],
                ["Correction of faults and defects in the platform", "Additional training sessions beyond those included at onboarding"],
                ["Configuration changes (new class, subject, term, user, fee structure)", "Bespoke development - new modules or customised documents beyond standard outputs"],
                ["Platform updates and improvements during the licence period", "Migration of several years of historical results or legacy archive data"],
                ["Daily backups, monitoring and security patching", "Hardware, internet connectivity or on-site network work"],
                ["Guidance, materials and refresher enablement", "Third-party costs such as SMS credits at the provider's rate, where applicable"],
            ],
            widths=[3.5, 3.5],
            caption="No hidden charges: what is included is stated, and what is not included is stated.",
        ),

        h2("11.5  Maintenance and change management"),
        bullets([
            "**Updates are released to hosted instances without the school doing anything** - there is no installer to run and no version file to manage.",
            "**Planned maintenance happens outside school hours**, and the school is notified in advance.",
            "**No silent structural changes.** Where an update affects something the school relies on - a report layout, a fee calculation, a screen - the school is told what changed and why.",
            "**Data structure changes are migrated through version-controlled migrations**, so an upgrade cannot corrupt existing records.",
            "**The school always has a rollback position:** if an update causes a problem, the previous known-good state of the data can be restored.",
        ]),

        h2("11.6  Reporting and accountability"),
        table(
            ["Report", "Frequency", "Contents"],
            [
                ["Service summary", "Termly", "Issues raised and closed, response performance against the targets above, and anything the school should know about."],
                ["Usage summary", "Termly", "High-level adoption indicators - attendance completion, score entry, fee recording and parent portal activity."],
                ["Value review", "End of first term, then annually", "What the platform has changed in the school's numbers: collection rate, reporting time, arrears recovered."],
            ],
            widths=[1.6, 1.6, 3.8],
            caption="The school receives evidence, not reassurance.",
        ),

        h2("11.7  What we ask of the school to make support work"),
        numbered([
            "Report issues through the agreed channel, with a screenshot or an example pupil/record where possible - it halves the time to fix.",
            "Keep a **single point of contact** for support (normally the staff champion) so information is not lost between people.",
            "Keep staff phone numbers and pupil guardian numbers up to date - most 'the SMS did not arrive' cases are a number problem, not a platform problem.",
            "Tell us **before** termly peak events (report cards, promotions, fee reminders) so we can plan capacity around them.",
            "Confirm who is authorised to request changes such as fee structures or user access, so we act only on authorised instructions.",
        ]),
        pagebreak(),
    ]


def _data_migration(cfg):
    return [
        h1("12. Data Migration & Bulk Import"),
        lead("A school management system is only as good as the register behind it. This "
             "section explains exactly how your existing records - classes, subjects, staff, "
             "pupils, guardians and fees - move into %s, what we do with the data we cannot "
             "carry across, and how the school signs off that the numbers are right."
             % cfg["product"]),

        h2("12.1  One workbook collects everything we need"),
        p("Rather than exchanging dozens of files and WhatsApp messages, we work from a single "
          "**School Onboarding Template**. It is a spreadsheet with one sheet per kind of "
          "record, coloured so that nothing is ambiguous: working sheets, example rows shaded "
          "green, and columns the platform fills in itself shaded grey."),
        table(
            ["Sheet", "What it captures", "Key columns", "Who fills it"],
            [
                ["README", "Plain-language instructions, formatting rules and a checklist of what to have ready.", "Instructions only - no data entry.", "Nobody (reference)"],
                ["School Info", "The school's identity, used on report cards, receipts and SMS.", "School Name, Abbreviation, Motto, Address, Region, District, Phone, Email, Logo", "Head / Administrator"],
                ["Classes", "Every class and stream on roll, and its class teacher.", "Class Name, Level, Section, Class Teacher Name", "Administrator"],
                ["Subjects", "The subjects taught, with short codes for reports.", "Subject Name, Code", "Academic head"],
                ["Staff", "Every user of the system - administrators and teachers.", "First Name, Last Name, Phone, Email, Role, Qualification, Class Teacher Of, Subjects Taught", "Head / Administrator"],
                ["Students", "The full pupil register with the guardian who will receive SMS.", "First Name, Last Name, Date of Birth, Gender, Class, Address, Parent Name, Parent Phone", "Class teachers, compiled by office"],
                ["Fee Structure", "What each class pays this term.", "Fee Band Name, Class Level, Amount (GHS), Term, Year", "Accounts / Bursar"],
                ["Terms", "Term names and dates, and which term is current.", "Term Name, Year, Start Date, End Date, Is Current", "Administrator"],
            ],
            widths=[1.1, 2.6, 2.9, 1.2],
            caption="Sheets are completed in order, because later sheets refer to earlier ones - "
                    "students reference classes, for example.",
        ),
        callout("Four rules that prevent most import problems",
                "**Fill the sheets in order** (School Info, Classes, Subjects, Staff, Students, "
                "Fees, Terms). **One row per record** - classes and subjects must exist before "
                "pupils refer to them. **Delete the green example rows** before returning the "
                "file. **Leave grey auto-generated columns blank** - Class IDs, Staff IDs and "
                "Student IDs are created by the platform, and typing into them causes clashes. "
                "Dates are written YYYY-MM-DD, phone numbers are 10 digits beginning with 0, and "
                "amounts are plain numbers in Ghana Cedis.",
                kind="info"),
        pagebreak(),
    ]

def _data_migration_2(cfg):
    return [
        h2("12.2  Two ways your data gets in"),
        table(
            ["Route", "How it works", "Best for", "Who does the work"],
            [
                ["Guided onboarding (recommended for go-live)",
                 "The school returns the completed onboarding workbook. We load it in the correct order, resolve the exceptions, and hand back a verification report. Pupils, guardians, staff, classes, subjects, fee bands and terms are all set up together.",
                 "A full first-time setup, or a school leaving another system mid-year.",
                 "We do the loading; the school answers the exceptions."],
                ["Self-service CSV import in the app",
                 "Administrators use **Import** on the Students and Teachers screens. The app provides a downloadable CSV template, parses the file, shows a preview, then commits only what passes validation.",
                 "Adding a new intake, a new class, or new staff during the term - without waiting for us.",
                 "The school's administrator, unaided."],
            ],
            widths=[1.6, 3.4, 1.6, 1.4],
            caption="Both routes use the same validation rules, so a file that works with us works in the app.",
        ),

        h2("12.3  Self-service import - exactly what the school sees"),
        p("The import screens are deliberately built as **Download template, fill, upload, "
          "preview, confirm**. Nothing is committed until the administrator has seen how many "
          "rows will be created, and the class the file belongs to can be selected in the same "
          "dialog so that rows without a class are not left stranded."),
        table(
            ["Screen", "Template columns (left to right)", "Limits and behaviour"],
            [
                ["Students  >  Bulk Import",
                 "firstName, middleName, lastName, dateOfBirth, gender, address, className, guardianName, guardianPhone, guardian2Name, guardian2Phone",
                 "Up to 500 rows per file. Choose the class for the file (or a default class) in the dialog. Gender must be MALE or FEMALE. guardianPhone creates the guardian record and links the pupil to it - it doubles as the parent portal lookup number. A second guardian may be supplied or left blank."],
                ["Teachers  >  Bulk Import",
                 "firstName, lastName, phone, qualification",
                 "Up to 100 rows per file. Phone number is the staff sign-in identity. Qualification is optional. Each imported teacher is issued an invitation to set a password."],
            ],
            widths=[1.5, 3.1, 3.4],
            caption="Student and staff identifiers are generated by the platform after import - they are never typed in by the school.",
        ),
        callout("What the platform does for you during a student import",
                "Creates a unique, non-clashing Student ID for each pupil and renumbers the class "
                "register in order; **de-duplicates guardians by phone number** so a parent with "
                "three children is one guardian record, not three; links each pupil to their "
                "guardian(s); and sets up the pupil's own student portal credential so they can "
                "start checking results and notes.",
                kind="success"),

        h2("12.4  When a row does not pass validation"),
        p("Imports are reported honestly: the platform returns a count of imported rows and a "
          "line-by-line list of failures with the reason. Valid rows are imported; bad rows are "
          "reported, corrected and re-uploaded. **Nothing is ever silently dropped.**"),
        table(
            ["What the school sees", "Why it happens", "The fix"],
            [
                ["Row 12: Missing first or last name", "A name cell was left blank.", "Fill both name columns. Middle name is optional."],
                ["Row 8: Invalid gender", "The gender cell is empty or spelled differently (e.g. 'Male ', 'M', 'Boy').", "Use exactly MALE or FEMALE - the template offers a dropdown."],
                ["Row 19: classId or class_name required", "The pupil could not be matched to a class - the class column is blank, misspelled, or the class does not exist yet.", "Create the class first, then import; or choose the class in the import dialog so blank class cells fall back to it."],
                ["Row 4: Duplicate phone / record already exists", "The pupil or staff member is already on roll from an earlier import.", "Check the existing record; no correction is needed if it is deliberate."],
            ],
            widths=[2.8, 2.6, 2.6],
            caption="The error report is written for an office administrator, not for an engineer - it says what to change and where.",
        ),
        pagebreak(),
    ]


def _data_migration_3(cfg):
    return [
        h2("12.5  Opening balances - starting mid-term without losing money"),
        p("Most schools do not adopt a system on the first day of a term. Adopting mid-term is "
          "normal, and fees already collected must not be lost or counted twice. We handle this "
          "with an explicit **opening balance** step:"),
        numbered([
            "We load the term fee structure first (what each class should pay this term).",
            "We then load, for each pupil, the amount already paid this term, with the date and "
            "the receipt reference where the school has one.",
            "The platform calculates each pupil's outstanding balance as **fee due minus payments "
            "recorded**, so arrears lists, receipts and the collection rate are correct from day one.",
            "Any figure the school cannot substantiate is left unrecorded rather than guessed - a "
            "balance the office cannot explain is worse than a balance the office knows is incomplete.",
        ]),
        callout("Why we insist on this step",
                "If opening balances are skipped, the school's own arrears report will disagree "
                "with the paper cash book and staff will stop trusting the system within a "
                "fortnight. Getting the starting position right is the single highest-value hour "
                "of the whole onboarding.",
                kind="warn"),

        h2("12.6  Historical results - an honest position"),
        table(
            ["Data type", "What happens by default", "Available on request"],
            [
                ["Current-term scores, attendance and fees", "Migrated as part of onboarding, using the school's own formats.", "-"],
                ["Prior-term report cards and results", "**Not loaded by default.** Last term's report cards stay as the school holds them (paper, PDF or spreadsheet). The new term starts clean, which is what the platform needs to calculate positions and aggregates correctly.", "A quoted migration of previous terms, where the school needs in-platform history for a promotion run, an audit, or a parent query. We assess the source files and give a fixed price before any work starts."],
                ["Legacy pupils who have left", "Not loaded. The register contains pupils on roll.", "Archived as inactive records if the school needs the history attached to the school rather than to individual pupils."],
                ["Anything the school holds as paper only", "Stays on paper; we do not transcribe by hand.", "Data-entry service, quoted per 100 records, if the school wants it."],
            ],
            widths=[1.9, 3.2, 2.9],
            caption="Being clear about this at the start avoids the most common source of disappointment in a school system rollout.",
        ),

        h2("12.7  Verification and sign-off"),
        p("Loading data is not the same as being ready. Before staff are trained on live data, "
          "the school verifies the loaded register against its own records - we provide the "
          "counts, the school checks them:"),
        table(
            ["Check", "What is compared", "Sign-off"],
            [
                ["Classes and subjects", "Number of classes and streams, and the subject list, against the school's own list.", "Academic head"],
                ["Staff", "Number of staff accounts, their roles, class-teacher assignments and subject assignments.", "Head teacher"],
                ["Pupils", "Number on roll per class, and total on roll, against the school's register. Spot-check 10 pupils in full (name, date of birth, class, guardian, guardian phone).", "Administrator / office"],
                ["Guardians", "Number of guardian records, and that siblings share one guardian record.", "Administrator / office"],
                ["Fees", "Fee bands per class level, and total fees due for the term.", "Bursar / accounts"],
                ["Opening balances", "Total collected so far this term against the school's cash book. These two totals must agree.", "Bursar / accounts"],
            ],
            widths=[1.6, 4.4, 2.0],
            caption="Verification is a shared exercise with named owners - not a technical handover.",
        ),

        h2("12.8  If something is wrong: rollback and re-import"),
        bullets([
            "**Imports are additive and reversible.** A mistaken batch can be deleted by the administrators who created it, or by us, and re-imported after correction - the school is never trapped with a bad load.",
            "**Nothing is deleted without authority.** Destructive changes are made on written instruction from a named school officer (the Head Teacher or the person they nominate).",
            "**Attendance, score and payment history is never touched by a data migration.** Corrections to live records are made through the normal screens, with the same audit trail as any other edit.",
            "**A rollback position always exists.** Because data is backed up daily and changes are tracked, a bad load is a recoverable event, not a crisis.",
            "**We keep our own copy of what we loaded** for the duration of onboarding, so a mistake on our side can be reconstructed without asking the school to redo its work.",
        ]),
        callout("The school's data is the school's data",
                "The register, results, payments and messages in the platform belong to the "
                "school, not to us. The school may request a full export at any time - including "
                "on the day it decides to stop using %s. There is no hostage clause and no "
                "export fee." % cfg["product"],
                kind="info"),
        pagebreak(),
    ]


def _pricing(cfg):
    unit = cfg["price_per_student_term"]
    per_week = round(float(unit) / 12.0, 2)
    counts = [120, 250, 400, 650, 900]
    rows = []
    for n in counts:
        rows.append([
            format(n, ","),
            _money(cfg, unit * n),
            _money(cfg, unit * n * 3),
            _money(cfg, per_week),
        ])

    return [
        h1("13. Pricing & Commercial Terms"),
        lead("Pricing should be the simplest paragraph in this document. It is: %s per active "
             "student per term. Everything else in this section explains what that does and does "
             "not include, so the board can approve it without asking a single follow-up question."
             % _money(cfg, unit)),

        h2("13.1  One line, no tiers, no surprises"),
        p("The school pays **%s for every pupil on roll, for each term**, and nothing else to use "
          "the platform. There is no per-user licence, no charge for teachers or for the head "
          "teacher, no charge for parents using the parent portal, no charge per module, and no "
          "implementation or setup fee. A pupil who is on roll is charged once per term, whatever "
          "their class, and however many modules the school switches on." % _money(cfg, unit)),
        kv([
            ["Price per active student, per term", _money(cfg, unit)],
            ["Billing frequency", "Per term - three invoices per academic year"],
            ["Setup / implementation fee", "None - onboarding is included"],
            ["Training included at onboarding", "%s live role-based sessions" % cfg["training_sessions_included"]],
            ["Charged on", "Pupils on roll on the agreed cut-off date for the term"],
            ["Minimum commitment", "One term - the school can stop at the end of any term"],
        ]),

        h2("13.2  What that means in practice"),
        table(
            ["Pupils on roll", "Cost per term", "Cost per academic year (3 terms)", "Cost per pupil per week"],
            rows,
            widths=[1.6, 1.8, 2.4, 2.2],
            caption="Academic year assumes the normal three terms; a pupil in school for 12 weeks "
                    "of a term costs about %s per week." % _money(cfg, per_week),
        ),
        p("Two properties of this model matter to a board:"),
        bullets([
            "**It scales with the school, in both directions.** Enrolment grows, the fee grows in "
            "proportion - and if enrolment falls, the bill falls with it. There is no fixed "
            "subscription that the school must cover out of a shrinking roll.",
            "**A new pupil costs very little; a new staff member costs nothing.** The marginal "
            "cost of the twentieth teacher, or of the fifth hundred parent, is zero. That is "
            "deliberate: a system that charges per adult user discourages staff from using it.",
        ]),
        callout("A sense of proportion",
                "At %s per pupil per term, a pupil's entire year on the platform costs about the "
                "price of a single exercise book a term, or a few minutes of a clerk's time. One "
                "recovered fee payment pays for several pupils for a whole year." % _money(cfg, unit),
                kind="success"),

        h2("13.3  What is included in the fee"),
        bullets([
            "**Every module in this document** - academic setup, students, classes and subjects, "
            "teachers, attendance, results and report cards, CBT and practice exams, fees and "
            "online payments, books, library and notes, promotions, communication, the parent "
            "portal, the student portal and reporting.",
            "**Unlimited staff accounts** across all four roles, and unlimited parent and pupil "
            "portal access.",
            "**Onboarding and data load** - the guided workbook process described in Section 12.",
            "**%s live training sessions** for administrators, office staff, class teachers and "
            "subject teachers, plus the written guides and templates the school keeps."
            % cfg["training_sessions_included"],
            "**Support** under the service levels in Section 11 - unlimited requests, one number, "
            "one email.",
            "**Hosting, backups, monitoring, security patching and platform updates** for the "
            "whole licence period. There is no server for the school to buy, patch or replace.",
            "**Report cards, transcript-style result documents, receipts and registers** produced "
            "in the platform and printed by the school without any per-document charge.",
        ]),
        pagebreak(),
    ]


def _pricing_2(cfg):
    unit = _money(cfg, cfg["price_per_student_term"])
    return [
        h2("13.4  What is outside the fee"),
        p("Being explicit about exclusions is what makes the price credible. Four things sit "
          "outside the %s per pupil per term:" % unit),
        table(
            ["Item", "How it is handled"],
            [
                ["SMS credits", "Text messages are sent through a commercial gateway, which charges per message. The school buys credit at the gateway's own rate - we add nothing on top. The platform shows message usage so the school can see exactly where credit goes."],
                ["Mobile money / online payment charges", "Where the school collects fees online, the mobile money provider applies its own transaction charge. Those charges are visible in the platform's payment records and reconciliations, line by line."],
                ["Hardware, internet and printing", "Devices, data bundles, printers and paper are the school's own procurement. Our obligation is that the platform runs well in a normal browser on ordinary school devices over a normal connection."],
                ["Work beyond the licence", "On-site visits outside Greater Accra, extra training sessions, bespoke development, hand-transcription of paper records, and migration of several years of historical results are quoted and approved in writing **before** any work begins. Nothing is ever added to an invoice that the school has not approved."],
            ],
            widths=[1.9, 5.7],
            caption="Section 11.4 lists the same boundary from a support point of view - the two lists are deliberately identical.",
        ),

        h2("13.5  How billing works"),
        numbered([
            "**The school is invoiced once per term**, at the start of the term, not monthly. Three "
            "invoices a year match the school's own fee-collection cycle and keep administration low.",
            "**Each invoice states the pupil count and shows its working** - number on roll per "
            "class, the cut-off date used, and the arithmetic. The bursar can check the invoice "
            "against the register in the platform in under five minutes.",
            "**The count is taken on an agreed cut-off date** in the first weeks of term (the start "
            "of term, or a date the bursar prefers). Pupils who join after the cut-off are picked "
            "up on the next term's invoice; pupils who leave before it are not charged for that "
            "term.",
            "**Payment is by bank transfer or mobile money** to the account shown on the invoice, "
            "within the period agreed with the school (standard proposal: 14 days from the invoice "
            "date).",
            "**If the school hits genuine financial difficulty, say so early.** We would far rather "
            "agree a staged payment than switch off a school's records in the middle of a term - "
            "and we say that in advance, not as a concession.",
        ]),

        h2("13.6  How the price stays fair over time"),
        bullets([
            "**No price change mid-term, and none mid-year.** The rate on the term invoice stands "
            "for that term.",
            "**Any future rate change is notified at least one full term in advance**, in writing, "
            "with the reason - so the school can budget for it, or decide not to renew.",
            "**The count is never self-reported.** It comes from the platform's own register, "
            "which the school can see, so neither party can dispute what is being charged.",
            "**Growth is charged as growth, not as a renegotiation.** Passing 500 pupils does not "
            "trigger a new contract or a new rate - it simply means the next term's invoice "
            "reflects 500 pupils.",
            "**A second campus or annex is a conversation, not an automatic charge.** We quote it "
            "so the board can decide.",
        ]),

        h2("13.7  Exit, notice and continuity"),
        table(
            ["Question a board will ask", "The answer in this proposal"],
            [
                ["How do we stop?", "With written notice before the end of a term. No notice period longer than one term, no exit penalty and no termination fee."],
                ["What happens to our data if we stop?", "The school can export its records at any time, including on the last day. Nothing is held back and no exit fee is charged."],
                ["Are we locked in by a contract term?", "The commitment is one term at a time. There is no multi-year lock-in and no automatic renewal the school cannot escape."],
                ["What if we pause for a term?", "The school can pause between terms and return - the data stays where it is. We would rather a school pause than keep paying for a term it cannot use."],
                ["What if the platform is not right for us?", "We would rather say so during onboarding than take money for something that does not fit. That is why the first term is the whole commitment."],
            ],
            widths=[2.4, 5.2],
            caption="A school should be able to leave easily. That is precisely what makes staying a real decision.",
        ),
        callout("What the board is being asked to approve",
                "**%s per pupil on roll, per term.** No setup fee, no per-user charge, no charge "
                "for parents or pupils using the portals, onboarding and %s training sessions "
                "included, one term's notice to stop, and the school's data exportable at any "
                "time. Everything else in this document is the working detail behind those five "
                "facts." % (unit, cfg["training_sessions_included"]),
                kind="success"),
        pagebreak(),
    ]


def _next_steps(cfg):
    unit = cfg["price_per_student_term"]
    return [
        h1("14. Why Now, and What Happens Next"),
        lead("Nothing in this document is complicated, and nothing in it is expensive. The only "
             "real decision is whether the school spends another term running its records the way "
             "it runs them today - so this final section is about timing, decisions and the first "
             "two weeks after the school says yes."),

        h2("14.1  The honest cost of waiting a term"),
        p("The cost of adopting %s is %s per pupil per term. The cost of waiting is harder to see, "
          "because it arrives as small daily losses rather than an invoice."
          % (cfg["product"], _money(cfg, unit))),
        table(
            ["What waiting another term means", "What it looks like in practice"],
            [
                ["Reporting week is done by hand again", "Staff add totals, averages, positions and remarks on paper or in a spreadsheet for every class, then check each other's arithmetic - the same days of work, repeated."],
                ["Fee arrears age further", "Balances that were recoverable in term one become 'difficult' by term two and written off by term three. For a 400-pupil school collecting %s per pupil, a two-percentage-point improvement in collection is %s - half the platform fee for the term, from one small change." % (_money(cfg, 250), _money(cfg, 2000))],
                ["Parents stay uninformed", "Guardians keep asking the office for results, attendance and balances by phone or in person, because they cannot look them up themselves."],
                ["Attendance disputes cannot be settled", "Without a dated daily record, a disagreement about a pupil's attendance is decided by memory."],
                ["Historical data gets harder to migrate", "Every term adds a new set of books, formats and mid-term changes. The longer the school waits, the more reconciliation work the move becomes."],
                ["The first-term learning curve lands later", "Whatever term the school starts in, there is a settling-in period. Starting at a term boundary costs the school nothing; starting two weeks before report cards costs it a great deal."],
            ],
            widths=[2.4, 5.2],
            caption="Waiting is not a neutral choice. It is a decision to keep paying the current price in staff hours, arrears and unhappy parents.",
        ),

        h2("14.2  Decisions the board needs to make"),
        numbered([
            "**Approve the platform and the price** - %s per pupil on roll per term, no setup fee, "
            "including onboarding and training, cancellable at the end of any term."
            % _money(cfg, unit),
            "**Nominate a staff champion** - one person inside the school who owns the system day "
            "to day, is our single point of contact, and is given the time and authority to do it.",
            "**Name the data owners** for each sheet in the onboarding workbook - the academic "
            "head for classes and subjects, the office for the register, the bursar for fees.",
            "**Choose a go-live week** at or near a term boundary, so the change lands when nothing "
            "else is happening.",
            "**Decide what happens to last term's report cards** - whether they stay as they are "
            "(our default) or whether historical migration is quoted, so it can be budgeted for.",
            "**Confirm guardians can be reached on the numbers in the register** - the single "
            "biggest determinant of whether the parent portal and SMS alerts deliver value.",
        ]),
        spacer(),
    ]


def _next_steps_2(cfg):
    return [
        h2("14.3  The 30 / 60 / 90-day view"),
        table(
            ["Timeframe", "What the school should see"],
            [
                ["First 30 days", "Agreement signed, onboarding workbook issued and returned, staff accounts created, data loaded and verified against the school's own counts, and the staff who matter trained. The platform is live with real data."],
                ["Days 30-60", "Attendance taken daily through the platform; scores entered for the first assessments; fees recorded with receipts; first arrears lists produced from real data instead of memory."],
                ["Days 60-90", "First report-card run produced in the platform at a fraction of the usual time; parent and pupil portals in use; first termly service and usage review with the school; the school decides the next term's configuration."],
            ],
            widths=[1.5, 6.1],
            caption="Ninety days is enough to judge the platform on evidence rather than on a demonstration.",
        ),

        h2("14.4  What happens in the first two weeks after the school says yes"),
        numbered([
            "We agree dates on paper - go-live week, training days and the data cut-off used for fees.",
            "The onboarding workbook goes out, with a short call to walk the office through it.",
            "The school returns the workbook; we load it, resolve exceptions with the named owners, "
            "and send back the verification counts for sign-off.",
            "We set up the school's profile - name, abbreviation, motto, logo, classes, subjects, "
            "terms, fee structures and the letterhead used on report cards.",
            "Administrators are trained first, on real data, so they can support their own staff.",
            "Class teachers and subject teachers are trained in their own role, using their own "
            "classes and subjects.",
            "Guardians are informed by SMS, the parent portal is opened, and the first live week "
            "runs with us on hand.",
        ]),
        callout("Our promise about the first week",
                "During the first week of live use we behave as though we are part of the school's "
                "staff: available, patient, and fixing things rather than explaining why they "
                "cannot be fixed. If the school's first impression of %s is a busy signal, we have "
                "failed regardless of how good the software is." % cfg["product"],
                kind="info"),

        h2("14.5  Three ways to proceed"),
        table(
            ["Option", "What it means", "Best when"],
            [
                ["Sign and go live this term", "We start onboarding immediately and target the go-live week agreed with the school.", "The board is satisfied with the scope and price, and a term boundary is close enough to work towards."],
                ["See it with your own data first", "Send us a sample register (or the filled onboarding workbook) and we run a live walkthrough using your own classes, pupils and fee bands.", "The board wants proof rather than a slide deck before committing."],
                ["Pilot one section", "One class or one stream uses attendance, results and fees for a term, with a small subset of staff, before the whole school follows.", "A cautious board that wants evidence from inside the school before a school-wide decision."],
            ],
            widths=[1.9, 3.5, 2.2],
            caption="Any of the three is a genuinely fine answer. What we would rather avoid is indefinite deferral, which costs the school without deciding anything.",
        ),

        h2("14.6  Contact and how to reach us"),
        kv([
            ["Who to speak to", "%s, %s" % (cfg["contact_name"], cfg["contact_role"])],
            ["Phone", cfg["contact_phone"]],
            ["Alternative phone", cfg["contact_alt_phone"]],
            ["Email", cfg["contact_email"]],
            ["Location", cfg["contact_location"]],
            ["Product", "%s - %s" % (cfg["product_full"], cfg["tagline"])],
        ]),
        p("We are happy to attend a board meeting, a PTA session or a staff briefing - in person or "
          "online - and to answer technical questions in front of the people who will use the "
          "system every day. That is usually the fastest route to a decision."),
        hr(),
    ]


def _acceptance(cfg):
    return [
        h2("14.7  Acceptance and sign-off"),
        p("Two signatures on this page are enough to begin. What is being accepted is the scope, "
          "price and terms set out in this document - nothing more, and nothing implied."),
        table(
            ["What the school is accepting", "Where it is described"],
            [
                ["Scope of supply - the modules and features the school will receive", "Sections 5, 6 and 7"],
                ["Training plan and the sessions included in the licence", "Section 10"],
                ["Support arrangements and service levels", "Section 11"],
                ["Technical, security and data-protection arrangements", "Section 8"],
                ["Implementation plan, onboarding workbook and data migration", "Sections 9 and 12"],
                ["Price, billing, payment terms, notice period and exit rights", "Section 13"],
                ["Timing, decisions required and the go-live path", "Section 14"],
            ],
            widths=[4.9, 2.7],
            caption="Any change to this scope is agreed in writing, and priced, before the work starts.",
        ),
        p("By signing below, the school confirms that it has read this document, that the pupil "
          "figures and fee structures it will supply are accurate, and that it wishes to proceed "
          "with %s on the terms set out above. Signing does not commit the school beyond its "
          "current term." % cfg["product"]),
        signature_block(),
        hr(),
        p("Thank you for taking the time to read this proposal in full. It was written to be read "
          "and approved by a school, not to be admired by an engineer - and if any part of it is "
          "still unclear, that is our failure, not the reader's."),
        pagebreak(),
    ]


def _appendix_a(cfg):
    return [
        h1("Appendix A - Results, Grading and the Report Card"),
        p("Every mark a teacher enters is turned into a grade, a position, an average and a printed "
          "report card by fixed rules. This appendix sets those rules out in full, so that a head "
          "teacher or an examiner can check any figure on any report card without telephoning us."),

        h2("A.1  How a subject total is calculated"),
        numbered([
            "The school defines the assessments for the subject in the term - class tests, homework, "
            "projects, practicals, end-of-term examinations - and gives each one a total mark, for "
            "example 20 for a class test or 100 for an examination.",
            "The school sets the weight each assessment carries in the final subject mark. The "
            "weights for a subject must add up to 100%.",
            "Each pupil's raw score is scaled to its weight: **(raw score / assessment total mark) x "
            "weight**. A pupil who scores 18 out of 20 on a test weighted 10% earns 9.00 towards the "
            "subject.",
            "The scaled scores are added together to give the **subject total**, rounded to two "
            "decimal places. Nothing is rounded until the end, so no rounding error creeps in.",
            "Assessments of type **test or assignment** are added up separately as the pupil's "
            "**class score**, and examinations as the **exam score**. The report card prints all "
            "three figures: class score, exam score and total.",
            "A pupil with no score recorded for an assessment scores zero for it. An unentered mark "
            "therefore shows up honestly as a lower total rather than as a blank space - which is "
            "why teachers are asked to enter a mark for every pupil, even if it is zero.",
        ]),

        h2("A.2  The grading scale"),
        p("The platform grades a subject total using the Ghana Education Service scale below. The "
          "boundaries are exact: 64 is a C4, 70 is a B2."),
        table(
            ["Mark range", "Grade", "Remark", "What it tells a parent"],
            [
                ["80 - 100", "A1", "Excellent", "Exceptional work with a secure command of the subject."],
                ["70 - 79", "B2", "Very Good", "Strong, confident performance."],
                ["65 - 69", "B3", "Good", "Solid work, with clear room for improvement."],
                ["60 - 64", "C4", "Credit", "A fair pass; the basics are in place."],
                ["55 - 59", "C5", "Credit", "A pass, but only when supported."],
                ["50 - 54", "C6", "Credit", "A marginal pass - this pupil needs watching."],
                ["45 - 49", "D7", "Pass", "Below the standard expected for the class."],
                ["40 - 44", "E8", "Pass", "Weak; needs structured remedial support."],
                ["Below 40", "F9", "Fail", "The subject has not been mastered at this level."],
            ],
            widths=[1.4, 1.0, 1.4, 3.8],
            caption="The same scale is used for every subject, class and term, so a C4 in Class 4 means the same as a C4 in JHS 2.",
        ),

        h2("A.3  Positions - how a pupil is ranked"),
        bullets([
            "**Subject position** is the pupil's rank within their own class for that subject in that "
            "term, calculated from the subject total.",
            "**Ties share a position, and the next pupil steps over the skipped number.** Two pupils "
            "on the same total are both 2nd, and the following pupil is 4th - not 3rd. This is the "
            "standard method, and it is applied consistently rather than decided by the order marks "
            "were typed in.",
            "**Positions are never calculated across classes.** A pupil is compared only with the "
            "pupils they actually sit with.",
            "**A position is a statement about one term only.** It is not carried forward, so an "
            "August position never changes because of September marks.",
        ]),
        callout("One formula, applied everywhere",
                "The same calculation produces the subject total, grade, remark and position "
                "wherever it appears - the class results screen, the pupil's own page, the parent "
                "portal and the printed report card. There is no second spreadsheet and no manual "
                "arithmetic that could disagree with the first.",
                kind="success"),
        spacer(),
    ]


def _appendix_a_2(cfg):
    return [
        h2("A.4  Every figure on the report card, and where it comes from"),
        table(
            ["Report card field", "How the platform arrives at it"],
            [
                ["Class score", "The pupil's weighted class tests and assignments added together."],
                ["Exam score", "The pupil's weighted examination papers added together."],
                ["Subject total", "Class score plus exam score, to two decimal places."],
                ["Grade and remark", "Read off the scale in A.2 using the subject total."],
                ["Subject position", "The pupil's rank in the class for that subject this term, with ties sharing a position."],
                ["Total score", "The pupil's subject totals added together for the term."],
                ["Average", "Total score divided by the number of subjects taken, to two decimal places."],
                ["Aggregate (JHS only)", "The sum of the pupil's positions in their best six subjects - the figure JHS pupils need. It is calculated only for JHS classes, and is left blank for lower classes."],
                ["Days present", "Days marked present, plus days marked late, for that pupil in the term."],
                ["Days in term", "Every day the class was recorded in the term register."],
                ["Promotion", "Recorded when the school runs the promotion exercise. An average of 50 is the platform's default suggestion - the school decides, and records its decision."],
                ["Remarks and conduct", "Written by the class teacher and the head teacher, and stored with the term's results so the printed card and the portal always show the same words."],
                ["Vacation date and next term begins", "Taken from the school's own term dates in Academic Setup."],
                ["Class teacher, class size, photograph", "Taken from the class record and the pupil's profile - never retyped on the card."],
            ],
            widths=[2.2, 5.4],
            caption="Every field is derived. No figure on the report card is typed by hand twice.",
        ),

        h2("A.5  A worked example"),
        p("So that the arithmetic is checkable, here is one JHS 2 pupil's term in full. The school "
          "weighted class work at 30% and the end-of-term examination at 70%."),
        table(
            ["Subject", "Class score", "Exam score", "Total", "Grade", "Position"],
            [
                ["English Language", "28.50", "40.00", "68.50", "B3", "5th"],
                ["Mathematics", "30.00", "42.00", "72.00", "B2", "3rd"],
                ["Integrated Science", "25.25", "36.00", "61.25", "C4", "8th"],
                ["Social Studies", "24.00", "35.00", "59.00", "C5", "10th"],
                ["Ghanaian Language", "32.50", "42.00", "74.50", "B2", "2nd"],
                ["Information & Communication Technology", "35.00", "46.00", "81.00", "A1", "1st"],
                ["Career Technology", "28.00", "38.00", "66.00", "B3", "6th"],
                ["TOTAL", "203.25", "279.00", "482.25", "-", "-"],
            ],
            widths=[3.0, 1.1, 1.1, 1.1, 0.8, 0.9],
            caption="Average = 482.25 / 7 subjects = 68.89. Best six positions = 1 + 2 + 3 + 5 + 6 + 8 = aggregate 25.",
        ),
        bullets([
            "**Total score** 482.25 is the sum of the seven subject totals.",
            "**Average** 68.89 is the total divided by seven, rounded to two decimal places.",
            "**Aggregate** 25 comes from the pupil's *positions*, not their marks: the six best positions "
            "(1st, 2nd, 3rd, 5th, 6th and 8th) added together. The 10th place in Social Studies is the "
            "one discarded, which is exactly how a JHS aggregate is meant to work.",
            "**Total class score** 203.25 and **total exam score** 279.00 add up to the 482.25 printed "
            "as the grand total - the same three figures the class results screen shows.",
        ]),
        callout("Check any card in under a minute",
                "Because the same three numbers - class score, exam score and total - appear on the "
                "results screen and on the printed card, a head teacher can reconcile a report card "
                "against the platform while the parent is still standing at the desk.",
                kind="info"),
        pagebreak(),
    ]


def _appendix_b(cfg):
    return [
        h1("Appendix B - Glossary"),
        p("School management has its own vocabulary, and software has a habit of making it worse. "
          "Every term below is used somewhere in this document, defined the way %s uses it." % cfg["product"]),
        table(
            ["Term", "What it means here"],
            [
                ["Academic year", "The school's year, made up of its terms. The year the current term belongs to is shown first wherever dates are displayed, and the years are labelled as GES styles them (for example 2025/2026)."],
                ["Administrator (ADMIN)", "A staff account that can set up the school, manage every record, publish results and see every report. Typically the head teacher, the assistant head, and one or two office staff."],
                ["Aggregate", "A JHS figure: the sum of a pupil's positions in their best six subjects. Lower is better - the best possible aggregate is 6."],
                ["Arrears / outstanding balance", "The term's fee due, minus the payments recorded against that pupil. Calculated by the platform, not by the bursar's notebook."],
                ["Assessment", "Any marked piece of work - a class test, an assignment, a project, a practical or an examination - with a total mark and a weight towards the subject."],
                ["Attendance status", "One of the four states a pupil is marked with each day: present, absent, late, or excused."],
                ["Bulk import", "Loading many records at once from a spreadsheet or CSV file, with a preview before anything is committed."],
                ["CBT (computer-based test)", "An online test sat on a device, marked automatically and recorded against the same subject as any paper assessment."],
                ["Class teacher", "The teacher responsible for a class: the register, the class results and the reported remarks. A class has one class teacher; a teacher may be class teacher of one class and a subject teacher in others."],
                ["Class score", "The portion of a subject total that comes from class work - tests, assignments and projects - as distinct from the examination."],
                ["Continuous assessment", "The running record of class work during the term, which the platform keeps per pupil, per subject, as it is entered."],
                ["Exam score", "The portion of a subject total that comes from the end-of-term examination."],
                ["Fee band / fee structure", "What a class level pays for a term. Set per class level and per term, and used to calculate every pupil's balance."],
                ["Guardian", "The parent or carer recorded against a pupil, identified by phone number. A guardian with three children in the school is one record linked to three pupils."],
                ["Opening balance", "The position on the day the school starts using the platform: what each pupil has already paid this term, so that balances continue correctly rather than restarting."],
                ["Parent (PARENT)", "A guardian with access to the parent portal, signing in with their phone number. Read-only: guardians can see, but never change, school records."],
                ["Parent portal", "The guardian's view - results, report cards, attendance and fee balances for their own children, looked up by phone number."],
                ["PIN", "The short numeric code a pupil changes on first use of the student portal. It is not a password shared with staff, and it cannot be used to reach any other pupil's record."],
                ["Position", "A pupil's rank in their class for a subject or overall. Ties share a position and the next rank skips a number (1, 2, 2, 4)."],
                ["Promotion", "Moving pupils to the next class at the end of the year, using the results already in the platform, with the school's decision recorded against each pupil."],
                ["Publishing results", "The deliberate step that releases a class's results to guardians and pupils. Until it is taken, results exist in the system but are not visible outside the staff who entered them."],
                ["Report card", "The printed term document for one pupil: subjects, class and exam scores, totals, grades, positions, average, aggregate (JHS), attendance, and the teacher's and head teacher's remarks."],
                ["Role", "What an account is allowed to do. The platform has four: ADMIN, TEACHER, PARENT and STUDENT."],
                ["Student ID", "The pupil's permanent identifier, generated by the platform and unique within the school. It is used for the student portal and never retyped by the school."],
                ["Student portal", "The pupil's own view - results, report cards and class notes - reached with a Student ID and PIN."],
                ["Subject teacher", "A teacher assigned to teach a subject to a class, able to enter scores for that subject and class only."],
                ["Teacher (TEACHER)", "A staff account, signing in with phone number and password, seeing their own classes and subjects and nothing beyond them."],
                ["Term", "One of the school's teaching periods, with a start date, an end date, and one of them marked as current. Results, attendance and fees are all held per term."],
                ["Wallet", "The school's collected balance inside the platform, held against the payments the school receives online, and available for payout to the school's own account."],
            ],
            widths=[1.9, 5.7],
            caption="If a word in this document is not on this list, it should not have been used in it.",
        ),
        pagebreak(),
    ]


def _appendix_c(cfg):
    return [
        h1("Appendix C - Data Templates the School Will Fill"),
        p("Nothing in Section 12 asks the school to invent a format. Every piece of information we "
          "need has a defined place, and both the onboarding workbook and the in-app import screens "
          "use the same columns."),

        h2("C.1  The onboarding workbook"),
        table(
            ["Sheet", "Columns", "Notes"],
            [
                ["README", "None - instructions only", "Read first. Contains the formatting rules and the readiness checklist."],
                ["School Info", "School Name, Abbreviation, Motto, Address, Region, District, Phone, Email, Logo", "Used on report cards, receipts and every SMS. Supply the logo as an image file alongside the workbook."],
                ["Classes", "Class Name, Level, Section, Class Teacher Name", "One row per class or stream - 'Class 4A' and 'Class 4B' are two rows. Level is one of the school's levels, from Nursery through JHS 3."],
                ["Subjects", "Subject Name, Code", "Codes appear on report cards and result sheets - keep them short (ENG, MATHS, SCI)."],
                ["Staff", "First Name, Last Name, Phone, Email, Role, Qualification, Class Teacher Of, Subjects Taught", "Phone number is the sign-in identity and must be unique. Role is ADMIN or TEACHER. 'Class Teacher Of' and 'Subjects Taught' use the names given in this workbook, not internal IDs."],
                ["Students", "First Name, Last Name, Date of Birth, Gender, Class, Address, Parent Name, Parent Phone", "One row per pupil. Gender must be MALE or FEMALE. Class must match a class on the Classes sheet. Parent Phone is the guardian's portal lookup number - a shared phone number creates one guardian for siblings."],
                ["Fee Structure", "Fee Band Name, Class Level, Amount (GHS), Term, Year", "Amounts are plain numbers in Ghana Cedis, without a currency symbol or thousands separator."],
                ["Terms", "Term Name, Year, Start Date, End Date, Is Current", "Exactly one term may be marked current. All dates are written YYYY-MM-DD."],
            ],
            widths=[1.3, 3.0, 3.3],
            caption="Fill the sheets in the order shown. Later sheets refer to earlier ones, so classes and subjects must exist before pupils refer to them.",
        ),

        h2("C.2  The in-app CSV templates"),
        p("The Students and Teachers screens each offer a **Download template** button. The file it "
          "produces has exactly these columns, in this order, with one example row the school "
          "overwrites."),
        h3("Students bulk import - up to 500 rows per file"),
        table(
            ["firstName", "middleName", "lastName", "dateOfBirth", "gender", "address", "className", "guardianName", "guardianPhone", "guardian2Name", "guardian2Phone"],
            [["Ama", "Akosua", "Mensah", "2016-04-12", "FEMALE", "Dansoman, Accra", "Class 4A", "Kofi Mensah", "0244123456", "Yaa Mensah", "0201987654"]],
            caption="Only the name, gender and class columns are essential. A cell may be left blank if "
                    "the school does not hold that detail - but the column must stay in place.",
        ),
    ]


# <<<APPEND>>>
