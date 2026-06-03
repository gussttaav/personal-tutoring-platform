// Server Component — pure content, no interactivity.
// Imported by both the dedicated policy pages (RSC) and FooterModals (client).
// This is the single source of truth for all policy text.

// ── Spanish content ────────────────────────────────────────────────────────────

function PrivacidadContentEs() {
  return (
    <>
      <p>Tu privacidad es importante. Esta política explica qué datos se recogen y cómo se usan.</p>

      <h3>Datos que se recogen</h3>
      <ul>
        <li><strong>Nombre y email</strong> — al iniciar sesión con Google o al realizar una compra, para gestionar tu cuenta y tus reservas.</li>
        <li><strong>Datos de pago</strong> — gestionados exclusivamente por Stripe. Nunca se almacenan datos de tarjeta.</li>
        <li><strong>Créditos y reservas</strong> — el saldo de clases compradas se guarda en una base de datos segura asociada a tu email.</li>
      </ul>

      <h3>Cómo se usan</h3>
      <ul>
        <li>Para gestionar tu acceso, reservas y saldo de clases.</li>
        <li>Para enviarte confirmaciones y recordatorios de clase por email.</li>
        <li>No se venden datos a terceros ni se usan con fines publicitarios.</li>
      </ul>

      <h3>Servicios de terceros</h3>
      <ul>
        <li><strong>Google OAuth</strong> — inicio de sesión. <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Política de Google</a>.</li>
        <li><strong>Stripe</strong> — procesamiento de pagos. <a href="https://stripe.com/es/privacy" target="_blank" rel="noopener noreferrer">Política de Stripe</a>.</li>
        <li><strong>Zoom</strong> — tecnología de aula virtual integrada en la plataforma para la realización de las sesiones. <a href="https://explore.zoom.us/es/privacy/" target="_blank" rel="noopener noreferrer">Política de Zoom</a>.</li>
        <li><strong>Supabase</strong> — base de datos donde se almacenan de forma segura las reservas, el saldo de créditos y los datos de cuenta.</li>
      </ul>

      <h3>Tus derechos</h3>
      <p>Puedes solicitar la eliminación de tus datos en cualquier momento escribiendo a <a href="mailto:contacto@gustavoai.dev">contacto@gustavoai.dev</a>.</p>

      <h3>Cookies</h3>
      <p>Solo se usan cookies estrictamente necesarias para la autenticación (NextAuth). Sin cookies de seguimiento ni publicidad.</p>

      <h3>Cambios en esta política</h3>
      <p>Cualquier cambio relevante se comunicará por email a los usuarios con cuenta activa.</p>
    </>
  );
}

function TerminosContentEs() {
  return (
    <>
      <p>Al reservar una sesión o adquirir un pack en este sitio, aceptas las condiciones que se describen a continuación.</p>

      <h3>Servicio</h3>
      <p>Gustavo Torres Guerrero ofrece clases particulares y consultoría en línea en las materias descritas en este sitio. Las sesiones se realizan por defecto en el <strong>aula virtual integrada en la plataforma</strong> (tecnología Zoom SDK), sin necesidad de instalar ningún programa. Si el alumno prefiere usar otra plataforma, puede acordarlo previamente con Gustavo.</p>

      <h3>Pagos</h3>
      <p>Los pagos se procesan de forma segura a través de <strong>Stripe</strong>, integrado directamente en la plataforma. No se almacenan datos de tarjeta. Se aceptan Visa, Mastercard y American Express. Al realizar un pago aceptas también los <a href="https://stripe.com/es/legal" target="_blank" rel="noopener noreferrer">términos de Stripe</a>.</p>

      <h3>Packs de clases</h3>
      <p>Los packs son de uso personal e intransferibles. La validez es de <strong>6 meses</strong> desde la fecha de compra. Los créditos no utilizados al vencimiento caducan sin derecho a reembolso.</p>

      <h3>Cancelaciones y reembolsos</h3>
      <p>Puedes cancelar o reprogramar cualquier clase con al menos <strong>2 horas de antelación</strong>. Para las clases de pack, el crédito se devuelve automáticamente. Para sesiones individuales pagadas, el reembolso está sujeto a la comisión de procesamiento que Stripe cobra por devolver un cargo (generalmente 0,25 € + entre el 1,5 % y el 1,9 % del importe; el resto se reembolsa en 1–3 días hábiles). Las cancelaciones con menos de 2 horas de antelación o las no presentaciones sin aviso no dan derecho a reembolso.</p>
      <p>Para solicitar el reembolso de un pack, si no se ha consumido ninguna clase se aplicará únicamente la comisión de Stripe. Si ya se han consumido clases, cada una se descontará al precio unitario de una sesión individual antes de calcular el reembolso, y se aplicará también la comisión de Stripe sobre el importe restante.</p>

      <h3>Responsabilidad</h3>
      <p>Las clases están orientadas a la formación y apoyo académico. No se garantizan resultados académicos específicos ni se asume responsabilidad por el uso que el alumno haga de los contenidos aprendidos.</p>

      <h3>Propiedad intelectual</h3>
      <p>Los materiales, ejercicios y recursos compartidos durante las sesiones son para uso exclusivo del alumno y no pueden distribuirse ni publicarse sin autorización expresa.</p>

      <h3>Modificaciones</h3>
      <p>Gustavo Torres Guerrero se reserva el derecho de actualizar estos términos. Los cambios relevantes se comunicarán con antelación razonable.</p>

      <h3>Contacto</h3>
      <p>Para cualquier consulta sobre estos términos escribe a <a href="mailto:contacto@gustavoai.dev">contacto@gustavoai.dev</a>.</p>
    </>
  );
}

function CancelacionContentEs() {
  return (
    <>
      <p>Puedes cancelar o reprogramar cualquier clase con al menos <strong>2 horas de antelación</strong>.</p>

      <h3>Clases de pack</h3>
      <p>Si cancelas con suficiente antelación, el crédito se devuelve automáticamente a tu pack y queda disponible para reservar otra clase. Los créditos no caducan de forma anticipada por cancelar — simplemente vuelven a tu saldo.</p>

      <h3>Sesiones individuales pagadas</h3>
      <p>Si cancelas con al menos 2 horas de antelación, el reembolso se tramita en un plazo de 1–3 días hábiles. Ten en cuenta que <strong>Stripe cobra una comisión por devolver un cargo</strong> (generalmente 0,25 € + entre el 1,5 % y el 1,9 % del importe); el importe restante se devuelve íntegramente. Si la cancelación se hace con menos de 2 horas de antelación o no se avisa de la no presentación, no se realizará reembolso.</p>

      <h3>Reembolso de packs</h3>
      <p>Puedes solicitar el reembolso de un pack no vencido. Si no has consumido ninguna clase, se aplica únicamente la comisión de Stripe sobre el importe total. Si ya has consumido alguna clase, cada una se descuenta al precio de una sesión individual antes de calcular el reembolso, y se aplica la comisión de Stripe sobre el importe restante. Por ejemplo: pack de 5 clases (75 €) con 1 clase consumida → reembolso = 75 − 16 − comisión Stripe.</p>

      <h3>Validez de los packs</h3>
      <p>Los packs tienen una validez de <strong>6 meses</strong> desde la fecha de compra. Los créditos no consumidos dentro de ese plazo caducan. Las cancelaciones dentro del período de validez siempre devuelven el crédito.</p>

      <h3>Encuentro inicial gratuito</h3>
      <p>El encuentro de 15 minutos es gratuito y se puede cancelar o reprogramar sin límite de tiempo previo.</p>

      <h3>Cómo cancelar o reprogramar</h3>
      <p>Tienes dos formas de hacerlo: usa el enlace de cancelación o reprogramación incluido en el email de confirmación, o accede a tu <strong>área personal</strong> dentro de la plataforma, donde puedes ver todas tus sesiones y gestionarlas directamente. También puedes escribir a <a href="mailto:contacto@gustavoai.dev">contacto@gustavoai.dev</a>.</p>

      <h3>Casos especiales</h3>
      <p>Si surge un imprevisto de última hora, escribe a contacto@gustavoai.dev. Gustavo lo resolverá de forma flexible siempre que sea posible.</p>
    </>
  );
}

// ── English content ────────────────────────────────────────────────────────────

function PrivacidadContentEn() {
  return (
    <>
      <p>Your privacy matters. This policy explains what data is collected and how it is used.</p>

      <h3>Data collected</h3>
      <ul>
        <li><strong>Name and email</strong> — when signing in with Google or making a purchase, to manage your account and bookings.</li>
        <li><strong>Payment data</strong> — managed exclusively by Stripe. Card details are never stored.</li>
        <li><strong>Credits and bookings</strong> — your class balance is stored in a secure database linked to your email.</li>
      </ul>

      <h3>How data is used</h3>
      <ul>
        <li>To manage your access, bookings and class balance.</li>
        <li>To send you booking confirmations and class reminders by email.</li>
        <li>Data is never sold to third parties or used for advertising purposes.</li>
      </ul>

      <h3>Third-party services</h3>
      <ul>
        <li><strong>Google OAuth</strong> — sign-in. <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>.</li>
        <li><strong>Stripe</strong> — payment processing. <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">Stripe Privacy Policy</a>.</li>
        <li><strong>Zoom</strong> — virtual classroom technology integrated into the platform for conducting sessions. <a href="https://explore.zoom.us/en/privacy/" target="_blank" rel="noopener noreferrer">Zoom Privacy Policy</a>.</li>
        <li><strong>Supabase</strong> — database where bookings, credit balances and account data are stored securely.</li>
      </ul>

      <h3>Your rights</h3>
      <p>You may request deletion of your data at any time by writing to <a href="mailto:contacto@gustavoai.dev">contacto@gustavoai.dev</a>.</p>

      <h3>Cookies</h3>
      <p>Only strictly necessary cookies are used for authentication (NextAuth). No tracking or advertising cookies.</p>

      <h3>Changes to this policy</h3>
      <p>Any significant changes will be communicated by email to users with an active account.</p>
    </>
  );
}

function TerminosContentEn() {
  return (
    <>
      <p>By booking a session or purchasing a pack on this site, you agree to the terms described below.</p>

      <h3>Service</h3>
      <p>Gustavo Torres Guerrero offers private tutoring and online consulting in the subjects described on this site. Sessions take place by default in the <strong>virtual classroom integrated into the platform</strong> (Zoom SDK technology), with no installation required. If you prefer to use another platform, this can be agreed in advance with Gustavo.</p>

      <h3>Payments</h3>
      <p>Payments are processed securely through <strong>Stripe</strong>, integrated directly into the platform. No card details are stored. Visa, Mastercard and American Express are accepted. By making a payment you also accept <a href="https://stripe.com/legal" target="_blank" rel="noopener noreferrer">Stripe&apos;s terms</a>.</p>

      <h3>Class packs</h3>
      <p>Packs are for personal use and are non-transferable. They are valid for <strong>6 months</strong> from the date of purchase. Unused credits expire at the end of the validity period without the right to a refund.</p>

      <h3>Cancellations and refunds</h3>
      <p>You may cancel or reschedule any class with at least <strong>2 hours&apos; notice</strong>. For pack classes, the credit is returned automatically. For paid individual sessions, the refund is subject to the processing fee Stripe charges for reversing a charge (typically €0.25 + between 1.5% and 1.9% of the amount; the remainder is refunded within 1–3 business days). Cancellations with less than 2 hours&apos; notice or no-shows without prior notification are not eligible for a refund.</p>
      <p>To request a refund for a pack, if no classes have been used, only the Stripe processing fee applies. If classes have already been used, each one will be deducted at the unit price of an individual session before calculating the refund, and the Stripe fee will also be applied to the remaining amount.</p>

      <h3>Liability</h3>
      <p>Sessions are intended for educational support. No specific academic results are guaranteed, and no responsibility is assumed for the use the student makes of the content learned.</p>

      <h3>Intellectual property</h3>
      <p>Materials, exercises and resources shared during sessions are for the student&apos;s personal use only and may not be distributed or published without express authorisation.</p>

      <h3>Modifications</h3>
      <p>Gustavo Torres Guerrero reserves the right to update these terms. Significant changes will be communicated with reasonable advance notice.</p>

      <h3>Contact</h3>
      <p>For any questions about these terms, write to <a href="mailto:contacto@gustavoai.dev">contacto@gustavoai.dev</a>.</p>
    </>
  );
}

function CancelacionContentEn() {
  return (
    <>
      <p>You may cancel or reschedule any class with at least <strong>2 hours&apos; notice</strong>.</p>

      <h3>Pack classes</h3>
      <p>If you cancel with sufficient notice, the credit is automatically returned to your pack and becomes available to book another class. Credits do not expire early due to cancellation — they simply return to your balance.</p>

      <h3>Paid individual sessions</h3>
      <p>If you cancel with at least 2 hours&apos; notice, the refund is processed within 1–3 business days. Please note that <strong>Stripe charges a fee for reversing a charge</strong> (typically €0.25 + between 1.5% and 1.9% of the amount); the remaining amount is refunded in full. Cancellations with less than 2 hours&apos; notice or no-shows without prior notification will not be refunded.</p>

      <h3>Pack refunds</h3>
      <p>You may request a refund for an unexpired pack. If no classes have been used, only the Stripe processing fee applies to the total amount. If you have already used some classes, each one is deducted at the price of an individual session before calculating the refund, and the Stripe fee is applied to the remaining amount. Example: 5-class pack (€75) with 1 class used → refund = 75 − 16 − Stripe fee.</p>

      <h3>Pack validity</h3>
      <p>Packs are valid for <strong>6 months</strong> from the date of purchase. Unused credits within that period expire. Cancellations within the validity period always return the credit.</p>

      <h3>Free initial meeting</h3>
      <p>The 15-minute initial meeting is free and can be cancelled or rescheduled with no time limit.</p>

      <h3>How to cancel or reschedule</h3>
      <p>You have two options: use the cancellation or reschedule link included in your confirmation email, or go to your <strong>personal area</strong> within the platform, where you can view all your sessions and manage them directly. You can also write to <a href="mailto:contacto@gustavoai.dev">contacto@gustavoai.dev</a>.</p>

      <h3>Special circumstances</h3>
      <p>If an unexpected last-minute situation arises, write to contacto@gustavoai.dev. Gustavo will handle it flexibly wherever possible.</p>
    </>
  );
}

// ── Locale-aware exports ───────────────────────────────────────────────────────

export function PrivacidadContent({ locale }: { locale?: string }) {
  return locale === "en" ? <PrivacidadContentEn /> : <PrivacidadContentEs />;
}

export function TerminosContent({ locale }: { locale?: string }) {
  return locale === "en" ? <TerminosContentEn /> : <TerminosContentEs />;
}

export function CancelacionContent({ locale }: { locale?: string }) {
  return locale === "en" ? <CancelacionContentEn /> : <CancelacionContentEs />;
}
