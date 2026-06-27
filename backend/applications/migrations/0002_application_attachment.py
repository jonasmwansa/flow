import applications.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("applications", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="application",
            name="attachment",
            field=models.FileField(
                blank=True,
                null=True,
                upload_to=applications.models.application_attachment_path,
            ),
        ),
    ]
