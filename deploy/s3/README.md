# S3 lifecycle for database backups

`backup-db.sh` uploads every dump under the `backups/` prefix. Local rotation
keeps 14 daily + 8 weekly copies; the bucket keeps everything for **60 days**
and then expires it, so the off-box history is deliberately longer than the
on-box one.

The policy is **not** applied automatically — it is a bucket-level setting and
applying it is a one-time administrative action:

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket "$AWS_BUCKET" \
  --endpoint-url "$AWS_ENDPOINT" \
  --lifecycle-configuration file://deploy/s3/backup-lifecycle.json
```

Verify:

```bash
aws s3api get-bucket-lifecycle-configuration --bucket "$AWS_BUCKET" --endpoint-url "$AWS_ENDPOINT"
```

The VPS has no `aws` CLI installed (uploads go through `backup-db-upload.php`
on the app's own S3 disk), so run the two commands above from a workstation
that has it, using the same credentials as `backend/.env`.

`AbortIncompleteMultipartUpload` is included because a dump interrupted
mid-upload otherwise leaves parts that are billed but invisible in listings.
