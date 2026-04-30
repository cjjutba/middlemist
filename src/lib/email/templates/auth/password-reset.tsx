import * as React from 'react';
import { Body, Container, Head, Heading, Html, Link, Preview, Text } from '@react-email/components';
import { body, button, container, h1, text, textMuted } from '../_styles';

type Props = {
  name: string;
  resetUrl: string;
  expiresInHours: number;
};

export default function PasswordReset({ name, resetUrl, expiresInHours }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Reset your Middlemist password</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Reset your password</Heading>
          <Text style={text}>Hi {name},</Text>
          <Text style={text}>Click below to set a new password.</Text>
          <Link href={resetUrl} style={button}>
            Reset password
          </Link>
          <Text style={textMuted}>
            This link expires in {expiresInHours} hour{expiresInHours === 1 ? '' : 's'}. If you
            didn&apos;t ask for this, you can ignore this email — your current password still works.
          </Text>
          <Text style={textMuted}>— Middlemist</Text>
        </Container>
      </Body>
    </Html>
  );
}
